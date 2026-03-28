import random
from locust import HttpUser, TaskSet, task, between, events
from locust.exception import RescheduleTask

# ──────────────────────────────────────────────
# CONFIG — Update with real credentials and IDs
# ──────────────────────────────────────────────

CUSTOMER_USERS = [
    {"username": "testcustomer1", "password": "password123"},
    {"username": "testcustomer2", "password": "password123"},
]

OUTLET_IDS = [1]             # Replace with your outlet ID(s)
PRODUCT_IDS = [1, 2, 3, 4]   # Replace with products for the outlet


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

def get_base(client):
    """Return clean base URL without spaces or trailing slashes."""
    return client.base_url.strip().replace(" ", "").rstrip("/")


def get_csrf(client):
    """Return the csrftoken cookie value."""
    return client.cookies.get("csrftoken", "")


def login(client, username, password):
    """Login and return True on success, False otherwise."""
    base = get_base(client)

    # GET login page to receive CSRF cookie
    resp = client.get("/", name="[GET] Login Page")
    if resp.status_code != 200:
        return False

    csrf = get_csrf(client)

    resp = client.post(
        "/",
        data={
            "username": username,
            "password": password,
            "csrfmiddlewaretoken": csrf,
        },
        headers={"Referer": base + "/"},
        name="[POST] Login",
        allow_redirects=True,
    )

    if resp is None or resp.url is None:
        return False

    return "/accounts/customer/home" in resp.url


def logout(client):
    """Logout the current session."""
    base = get_base(client)
    csrf = get_csrf(client)

    client.post(
        "/accounts/logout/",
        data={"csrfmiddlewaretoken": csrf},
        headers={"Referer": base + "/"},
        name="[POST] Logout",
        allow_redirects=True,
    )


# ──────────────────────────────────────────────
# CUSTOMER FLOW TASKSET
# ──────────────────────────────────────────────

class CustomerOrderFlow(TaskSet):

    def on_start(self):
        creds = random.choice(CUSTOMER_USERS)
        if not login(self.client, creds["username"], creds["password"]):
            raise RescheduleTask()

    def on_stop(self):
        logout(self.client)

    @task
    def order_flow(self):
        base = get_base(self.client)

        # 1️⃣ Visit an outlet
        outlet_id = random.choice(OUTLET_IDS)
        self.client.get(
            f"/accounts/outlet/{outlet_id}/",
            name="[GET] Outlet Page"
        )

        # 2️⃣ Pick 2–3 different products
        products = random.sample(PRODUCT_IDS, k=min(3, len(PRODUCT_IDS)))

        for product_id in products:

            # View product page
            self.client.get(
                f"/accounts/product/{product_id}/",
                name="[GET] Product Detail"
            )

            # Add product to cart
            csrf = get_csrf(self.client)
            self.client.post(
                f"/accounts/add-to-cart/{product_id}/",
                data={"csrfmiddlewaretoken": csrf},
                headers={"Referer": base + f"/accounts/product/{product_id}/"},
                name="[POST] Add to Cart",
                allow_redirects=True,
            )

        # 3️⃣ View cart
        self.client.get("/accounts/cart/", name="[GET] Cart")

        # 4️⃣ Place order
        csrf = get_csrf(self.client)
        self.client.post(
            "/accounts/place-order/",
            data={"csrfmiddlewaretoken": csrf},
            headers={"Referer": base + "/accounts/cart/"},
            name="[POST] Place Order",
            allow_redirects=True,
        )


# ──────────────────────────────────────────────
# CUSTOMER USER CLASS
# ──────────────────────────────────────────────

class CustomerUser(HttpUser):
    wait_time = between(2, 5)
    tasks = {CustomerOrderFlow: 1}


# ──────────────────────────────────────────────
# LOGGING SLOW / FAILED REQUESTS
# ──────────────────────────────────────────────

@events.request.add_listener
def log_requests(request_type, name, response_time, response_length, exception, **kwargs):
    if exception:
        print(f"[FAIL] {request_type} {name} — {exception}")
    elif response_time > 2000:
        print(f"[SLOW] {request_type} {name} — {response_time:.0f}ms")