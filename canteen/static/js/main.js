// Run theme initialization immediately to avoid page flash
(function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle button injection & behavior logic
    const initThemeToggle = () => {
        if (document.getElementById('theme-toggle-btn')) return;

        const nav = document.querySelector('nav') || document.querySelector('.navbar');
        
        // Create toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'theme-toggle-btn';
        toggleBtn.className = 'theme-toggle-btn';
        toggleBtn.setAttribute('aria-label', 'Toggle Theme');
        
        const updateButtonState = () => {
            const isLight = document.body.classList.contains('light-theme');
            toggleBtn.innerHTML = `
                <span class="theme-toggle-icon">
                    <i class="fa-solid ${isLight ? 'fa-sun' : 'fa-moon'}"></i>
                </span>
            `;
        };

        updateButtonState();

        toggleBtn.addEventListener('click', () => {
            document.body.classList.add('theme-transitioning');
            setTimeout(() => {
                document.body.classList.remove('theme-transitioning');
            }, 500);

            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            updateButtonState();
        });

        if (nav) {
            // Check if there is a nav-links container (customer_home)
            const navLinks = nav.querySelector('.nav-links');
            if (navLinks) {
                // Insert it before Cart button or at the start
                const primaryBtn = navLinks.querySelector('.nav-btn.primary') || navLinks.firstChild;
                navLinks.insertBefore(toggleBtn, primaryBtn);
            } else {
                // For other pages with nav, insert before the last child or nav-spacer
                const spacer = nav.querySelector('.nav-spacer') || nav.querySelector('.cart-btn') || nav.querySelector('.floating-cart');
                if (spacer) {
                    nav.insertBefore(toggleBtn, spacer);
                } else {
                    nav.appendChild(toggleBtn);
                }
            }
        } else {
            // Floating pill for pages without nav (like login/register)
            const floatContainer = document.createElement('div');
            floatContainer.style.position = 'fixed';
            floatContainer.style.top = '1.5rem';
            floatContainer.style.right = '1.5rem';
            floatContainer.style.zIndex = '99999';
            floatContainer.appendChild(toggleBtn);
            document.body.appendChild(floatContainer);
        }
    };

    initThemeToggle();

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