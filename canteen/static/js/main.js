document.addEventListener('DOMContentLoaded', () => {
    // 1) Dynamic Username Typing Animation (Login Page)
    const usernameInput = document.getElementById('id_username');
    const welcomeText = document.getElementById('welcomeText');
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const pageLoader = document.getElementById('pageLoader');
    const loaderText = document.getElementById('loaderText');

    if (usernameInput && welcomeText) {
        usernameInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val) {
                const displayVal = val.charAt(0).toUpperCase() + val.slice(1);
                welcomeText.innerHTML = `Welcome Back, <span>${displayVal}</span>`;
            } else {
                welcomeText.innerHTML = `Welcome Back, <span>Guest</span>`;
            }
        });
    }

    // 2) Full Screen Loading Animation Sequence (Login Form Submit)
    if (loginForm && submitBtn && pageLoader && loaderText) {
        loginForm.addEventListener('submit', (e) => {
            if (loginForm.checkValidity()) {
                e.preventDefault(); 
                submitBtn.disabled = true;
                submitBtn.innerHTML = 'Connecting...';
                pageLoader.classList.add('active');
                setTimeout(() => loaderText.innerText = "Verifying Credentials...", 500);
                setTimeout(() => loaderText.innerText = "Securing Session...", 1000);
                setTimeout(() => {
                    HTMLFormElement.prototype.submit.call(loginForm);
                }, 1200);
            }
        });
    }

    // 3) Product & Outlet Filtering logic
    const categorySelect = document.getElementById('categorySelect');
    const searchInput = document.getElementById('searchInput');
    const productItems = document.querySelectorAll('.product-item');

    function filterItems() {
        const categoryMatch = categorySelect ? categorySelect.value.toLowerCase() : 'all';
        const searchMatch = searchInput ? searchInput.value.toLowerCase() : '';

        productItems.forEach(item => {
            const rowCat = item.getAttribute('data-category') || '';
            const rowName = (item.getAttribute('data-name') || '').toLowerCase();
            const textMatch = (item.innerText || '').toLowerCase();
            
            const matchCat = categoryMatch === 'all' || rowCat === categoryMatch;
            const matchSearch = rowName.includes(searchMatch) || textMatch.includes(searchMatch);
            
            if (matchCat && matchSearch) {
                item.style.display = item.tagName === 'TR' ? 'table-row' : 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    if (categorySelect) categorySelect.addEventListener('change', filterItems);
    if (searchInput) searchInput.addEventListener('input', filterItems);

    // 4) Welcome Splash Auto-Redirect Loop
    const redirectPayload = document.getElementById('redirectPayload');
    if (redirectPayload) {
        const url = redirectPayload.getAttribute('data-url');
        if (url) {
            setTimeout(() => {
                window.location.href = url;
            }, 2000); // 2 second cinematic delay
        }
    }

});