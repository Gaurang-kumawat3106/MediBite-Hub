import json
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from accounts.models import Outlet, Order, PrintJob

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_outlet_head(username, outlet_name):
    user = User.objects.create_user(
        username=username,
        password="testpass123",
        is_outlet_head=True,
    )
    outlet = Outlet.objects.create(
        name=outlet_name,
        manager=user,
        is_approved=True,
        is_accepting_orders=True,
    )
    return user, outlet


def _make_customer(username):
    return User.objects.create_user(
        username=username,
        password="testpass123",
        is_customer=True,
    )


def _make_order_with_print_job(customer, outlet, amount="100.00"):
    order = Order.objects.create(
        user=customer,
        outlet=outlet,
        total_amount=amount,
        actual_amount=amount,
        platform_fee="0.00",
        payment_status="paid",
        status="preparing",
    )
    job = PrintJob.objects.create(
        order=order,
        outlet=outlet,
        status="pending",
    )
    return order, job


# ---------------------------------------------------------------------------
# Test class
# ---------------------------------------------------------------------------

class PrintIsolationTests(TestCase):
    """
    Multi-outlet print isolation test suite.

    Simulates:
      Outlet 1 -> Agent 1 -> Printer 1
      Outlet 2 -> Agent 2 -> Printer 2

    No physical printers required.
    """

    @classmethod
    def setUpTestData(cls):
        cls.head1, cls.outlet1 = _make_outlet_head("head_outlet1", "MediBite Outlet 1")
        cls.head2, cls.outlet2 = _make_outlet_head("head_outlet2", "MediBite Outlet 2")
        cls.customer = _make_customer("customer_test")
        cls.order1, cls.job1 = _make_order_with_print_job(cls.customer, cls.outlet1, "150.00")
        cls.order2, cls.job2 = _make_order_with_print_job(cls.customer, cls.outlet2, "200.00")

    def setUp(self):
        self.client = Client()
        PrintJob.objects.filter(pk=self.job1.pk).update(status="pending", printed_at=None)
        PrintJob.objects.filter(pk=self.job2.pk).update(status="pending", printed_at=None)

    # -- URL helpers --

    def _pending_url(self, outlet_id=None):
        url = reverse("print_agent_pending_jobs")
        if outlet_id is not None:
            url += f"?outlet_id={outlet_id}"
        return url

    def _ack_url(self):
        return reverse("print_agent_ack_job")

    def _get_pending(self, outlet_id=None):
        return self.client.get(self._pending_url(outlet_id))

    def _post_ack(self, payload):
        return self.client.post(
            self._ack_url(),
            data=json.dumps(payload),
            content_type="application/json",
        )

    # -------------------------------------------------------------------------
    # Test 01: Agent 1 /pending/ returns ONLY Outlet 1 jobs
    # -------------------------------------------------------------------------
    def test_01_agent1_pending_returns_only_outlet1_jobs(self):
        resp = self._get_pending(self.outlet1.id)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        job_ids = [j["job_id"] for j in data["jobs"]]
        outlet_ids = [j["outlet_id"] for j in data["jobs"]]
        self.assertIn(self.job1.id, job_ids, "Job 1 must be in Agent 1 response")
        self.assertNotIn(self.job2.id, job_ids, "Job 2 must NOT be in Agent 1 response")
        for oid in outlet_ids:
            self.assertEqual(oid, self.outlet1.id)

    # -------------------------------------------------------------------------
    # Test 02: Agent 2 /pending/ returns ONLY Outlet 2 jobs
    # -------------------------------------------------------------------------
    def test_02_agent2_pending_returns_only_outlet2_jobs(self):
        resp = self._get_pending(self.outlet2.id)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        job_ids = [j["job_id"] for j in data["jobs"]]
        outlet_ids = [j["outlet_id"] for j in data["jobs"]]
        self.assertIn(self.job2.id, job_ids, "Job 2 must be in Agent 2 response")
        self.assertNotIn(self.job1.id, job_ids, "Job 1 must NOT be in Agent 2 response")
        for oid in outlet_ids:
            self.assertEqual(oid, self.outlet2.id)

    # -------------------------------------------------------------------------
    # Test 03: Outlet 2 jobs are NEVER visible to Agent 1
    # -------------------------------------------------------------------------
    def test_03_outlet2_job_never_visible_to_agent1(self):
        _, extra_job = _make_order_with_print_job(self.customer, self.outlet2, "50.00")
        resp = self._get_pending(self.outlet1.id)
        returned_ids = [j["job_id"] for j in resp.json()["jobs"]]
        self.assertNotIn(extra_job.id, returned_ids,
                         "Extra outlet2 job must never appear in outlet1 response")

    # -------------------------------------------------------------------------
    # Test 04: Outlet 1 jobs are NEVER visible to Agent 2
    # -------------------------------------------------------------------------
    def test_04_outlet1_job_never_visible_to_agent2(self):
        _, extra_job = _make_order_with_print_job(self.customer, self.outlet1, "75.00")
        resp = self._get_pending(self.outlet2.id)
        returned_ids = [j["job_id"] for j in resp.json()["jobs"]]
        self.assertNotIn(extra_job.id, returned_ids,
                         "Extra outlet1 job must never appear in outlet2 response")

    # -------------------------------------------------------------------------
    # Test 05: /pending/ without outlet_id -> HTTP 400
    # -------------------------------------------------------------------------
    def test_05_pending_without_outlet_id_returns_400(self):
        resp = self._get_pending()
        self.assertEqual(resp.status_code, 400,
                         "Pending endpoint must return 400 when outlet_id is absent")
        self.assertIn("error", resp.json())

    # -------------------------------------------------------------------------
    # Test 06: /pending/ for non-existent outlet -> 200 empty list
    # -------------------------------------------------------------------------
    def test_06_pending_for_nonexistent_outlet_returns_empty(self):
        resp = self._get_pending(99999)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(len(data["jobs"]), 0)

    # -------------------------------------------------------------------------
    # Test 07: Disconnected Agent 1 - Outlet 1 jobs remain pending
    # -------------------------------------------------------------------------
    def test_07_outlet1_jobs_remain_pending_when_only_agent2_polls(self):
        """Simulates Agent 1 being offline; Agent 2 keeps polling its own outlet.
        Outlet 1 jobs must remain 'pending' in DB and never appear for Agent 2."""
        for _ in range(3):
            resp = self._get_pending(self.outlet2.id)
            agent2_ids = [j["job_id"] for j in resp.json()["jobs"]]
            self.assertNotIn(self.job1.id, agent2_ids,
                             "Outlet1 job must never appear in Agent2 poll")
        self.job1.refresh_from_db()
        self.assertEqual(self.job1.status, "pending",
                         "Outlet 1 job must remain pending while Agent 1 is offline")

    # -------------------------------------------------------------------------
    # Test 08: ACK ownership - Agent 1 can ACK its own job
    # -------------------------------------------------------------------------
    def test_08_agent1_can_ack_its_own_job(self):
        resp = self._post_ack({
            "job_id": self.job1.id,
            "outlet_id": self.outlet1.id,
            "status": "printed",
        })
        self.assertEqual(resp.status_code, 200,
                         f"Expected 200 got {resp.status_code}: {resp.content}")
        self.assertEqual(resp.json()["status"], "success")
        self.job1.refresh_from_db()
        self.assertEqual(self.job1.status, "printed")

    # -------------------------------------------------------------------------
    # Test 09: ACK mismatch - Agent 2 cannot ACK Outlet 1 job -> 403
    # -------------------------------------------------------------------------
    def test_09_agent2_cannot_ack_outlet1_job_returns_403(self):
        resp = self._post_ack({
            "job_id": self.job1.id,
            "outlet_id": self.outlet2.id,  # WRONG outlet
            "status": "printed",
        })
        self.assertEqual(resp.status_code, 403,
                         "Outlet mismatch ACK must return HTTP 403")
        self.assertIn("error", resp.json())
        self.job1.refresh_from_db()
        self.assertEqual(self.job1.status, "pending",
                         "Job must remain pending after rejected ACK")

    # -------------------------------------------------------------------------
    # Test 10: ACK mismatch - Agent 1 cannot ACK Outlet 2 job -> 403
    # -------------------------------------------------------------------------
    def test_10_agent1_cannot_ack_outlet2_job_returns_403(self):
        resp = self._post_ack({
            "job_id": self.job2.id,
            "outlet_id": self.outlet1.id,  # WRONG outlet
            "status": "printed",
        })
        self.assertEqual(resp.status_code, 403,
                         "Outlet mismatch ACK must return HTTP 403")
        self.job2.refresh_from_db()
        self.assertEqual(self.job2.status, "pending",
                         "Job must remain pending after rejected ACK")

    # -------------------------------------------------------------------------
    # Test 11: ACK without outlet_id in body - backward compatible
    # -------------------------------------------------------------------------
    def test_11_ack_without_outlet_id_field_still_succeeds(self):
        resp = self._post_ack({
            "job_id": self.job1.id,
            "status": "printed",
            # outlet_id intentionally omitted
        })
        self.assertEqual(resp.status_code, 200,
                         "Omitting outlet_id from ACK body must not break backward compat")
        self.job1.refresh_from_db()
        self.assertEqual(self.job1.status, "printed")

    # -------------------------------------------------------------------------
    # Test 12: Duplicate ACK -> already_printed (idempotency)
    # -------------------------------------------------------------------------
    def test_12_duplicate_ack_returns_already_printed(self):
        self._post_ack({"job_id": self.job1.id, "outlet_id": self.outlet1.id})
        resp = self._post_ack({"job_id": self.job1.id, "outlet_id": self.outlet1.id})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "already_printed",
                         "Second ACK must return 'already_printed'")

    # -------------------------------------------------------------------------
    # Test 13: Job payload outlet_id integrity
    # -------------------------------------------------------------------------
    def test_13_job_payload_outlet_id_integrity(self):
        for outlet_id in (self.outlet1.id, self.outlet2.id):
            resp = self._get_pending(outlet_id)
            for job in resp.json()["jobs"]:
                self.assertEqual(
                    job["outlet_id"], outlet_id,
                    f"Job {job['job_id']} has wrong outlet_id {job['outlet_id']} "
                    f"in response for outlet {outlet_id}"
                )

    # -------------------------------------------------------------------------
    # Test 14: Correct job count per outlet
    # -------------------------------------------------------------------------
    def test_14_correct_job_count_returned_per_outlet(self):
        _make_order_with_print_job(self.customer, self.outlet1, "99.00")
        count1 = len(self._get_pending(self.outlet1.id).json()["jobs"])
        count2 = len(self._get_pending(self.outlet2.id).json()["jobs"])
        self.assertEqual(count1, 2, f"Expected 2 outlet1 jobs, got {count1}")
        self.assertEqual(count2, 1, f"Expected 1 outlet2 job, got {count2}")

    # -------------------------------------------------------------------------
    # Test 15: ACK with non-numeric outlet_id -> 400
    # -------------------------------------------------------------------------
    def test_15_ack_with_invalid_outlet_id_type_returns_400(self):
        resp = self._post_ack({
            "job_id": self.job1.id,
            "outlet_id": "not-a-number",
        })
        self.assertEqual(resp.status_code, 400,
                         "Non-numeric outlet_id in ACK must return 400")

    # -------------------------------------------------------------------------
    # Test 16: /pending/ with non-numeric outlet_id -> 400
    # -------------------------------------------------------------------------
    def test_16_pending_with_non_numeric_outlet_id_returns_400(self):
        resp = self.client.get(reverse("print_agent_pending_jobs") + "?outlet_id=abc")
        self.assertEqual(resp.status_code, 400)

    # -------------------------------------------------------------------------
    # Test 17: Printed jobs do not reappear in /pending/
    # -------------------------------------------------------------------------
    def test_17_printed_jobs_not_returned_in_pending(self):
        self._post_ack({"job_id": self.job1.id, "outlet_id": self.outlet1.id})
        resp = self._get_pending(self.outlet1.id)
        returned_ids = [j["job_id"] for j in resp.json()["jobs"]]
        self.assertNotIn(self.job1.id, returned_ids,
                         "Printed job must not reappear in pending list")

    # -------------------------------------------------------------------------
    # Test 18: GET on /ack/ -> 405
    # -------------------------------------------------------------------------
    def test_18_ack_endpoint_rejects_get_method(self):
        resp = self.client.get(self._ack_url())
        self.assertEqual(resp.status_code, 405)

    # -------------------------------------------------------------------------
    # Test 19: POST on /pending/ -> 405
    # -------------------------------------------------------------------------
    def test_19_pending_endpoint_rejects_post_method(self):
        resp = self.client.post(self._pending_url(self.outlet1.id))
        self.assertEqual(resp.status_code, 405)

    # -------------------------------------------------------------------------
    # Test 20: ACK missing both job_id and order_id -> 400
    # -------------------------------------------------------------------------
    def test_20_ack_missing_identifiers_returns_400(self):
        resp = self._post_ack({"outlet_id": self.outlet1.id, "status": "printed"})
        self.assertEqual(resp.status_code, 400)
