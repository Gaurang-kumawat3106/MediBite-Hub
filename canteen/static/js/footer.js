document.addEventListener('DOMContentLoaded', () => {
    const policyLinks = document.querySelectorAll('.policy-link');
    const policyModalOverlay = document.getElementById('policyModal');
    const policyModalBody = document.getElementById('policyModalBody');
    const closeModalBtn = document.getElementById('closeModalBtn');

    policyLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const policyType = link.getAttribute('data-policy');
            const contentDiv = document.getElementById(`${policyType}-content`);
            
            if (contentDiv) {
                policyModalBody.innerHTML = contentDiv.innerHTML;
                policyModalOverlay.classList.add('active');
                document.body.style.overflow = 'hidden'; // prevent bg scatter
            }
        });
    });

    closeModalBtn.addEventListener('click', closePolicyModal);
    
    policyModalOverlay.addEventListener('click', (e) => {
        if (e.target === policyModalOverlay) {
            closePolicyModal();
        }
    });

    function closePolicyModal() {
        policyModalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => {
            policyModalBody.innerHTML = '';
        }, 400); // wait for transition
    }

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && policyModalOverlay.classList.contains('active')) {
            closePolicyModal();
        }
    });
});
