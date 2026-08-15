/* =========================================================
   BHUKKAD BOX — OUTLET DETAIL JS
   Optimized version

   Features:
   - Search
   - Category filtering
   - AJAX Add to Cart
   - Owl Carousel
   - Carousel after every 4 products
   - NO cloneNode()
   - NO duplicated original product DOM
========================================================= */

(function () {

    "use strict";


    /* =========================================================
       WAIT UNTIL DOM IS READY
    ========================================================= */

    document.addEventListener("DOMContentLoaded", function () {

        initOutletPage();

    });


    /* =========================================================
       MAIN INITIALIZATION
    ========================================================= */

    function initOutletPage() {

        const grid =
            document.getElementById("bbProductsGrid");

        const emptyEl =
            document.getElementById("bbEmpty");

        const searchOverlay =
            document.getElementById("bbSearchOverlay");

        const searchInput =
            document.getElementById("bbSearchInput");

        const searchFab =
            document.getElementById("bbSearchFab");

        const searchClose =
            document.getElementById("bbSearchClose");

        const cartUrlElement =
            document.getElementById("bbCartUrl");


        if (!grid) {
            return;
        }


        const cartUrl =
            cartUrlElement
                ? cartUrlElement.getAttribute("href")
                : "/cart/";


        /* =====================================================
           STORE ORIGINAL PRODUCT CARDS

           Important:
           We keep references to the original Django cards.
           No cloneNode() is used.
        ====================================================== */

        const productCards =
            Array.from(
                grid.querySelectorAll(
                    ".bb-pcard"
                )
            );


        /* =====================================================
           CART HANDLER
        ====================================================== */

        function addToCart(btn) {

            if (
                !btn ||
                btn.classList.contains("adding")
            ) {
                return;
            }


            btn.classList.add("adding");


            const originalHTML =
                btn.innerHTML;


            btn.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i>';


            fetch(
                btn.getAttribute("href"),
                {
                    method: "GET",

                    headers: {
                        "X-Requested-With":
                            "XMLHttpRequest",

                        "Accept":
                            "application/json"
                    },

                    credentials: "same-origin"
                }
            )

            .then(function (response) {

                if (!response.ok) {

                    throw new Error(
                        "HTTP " +
                        response.status
                    );

                }

                return response.json();

            })

            .then(function (data) {

                if (data.success) {

                    showToast(
                        (btn.dataset.product || "Item") +
                        " added to cart!",
                        "success"
                    );

                } else {

                    showToast(
                        data.message ||
                        "Could not add item.",
                        "error"
                    );

                }

            })

            .catch(function (error) {

                console.error(
                    "Add to cart error:",
                    error
                );


                showToast(
                    "Something went wrong.",
                    "error"
                );

            })

            .finally(function () {

                btn.classList.remove(
                    "adding"
                );

                btn.innerHTML =
                    originalHTML;

            });

        }


        /* =====================================================
           EVENT DELEGATION FOR ADD TO CART

           Instead of attaching one listener to every card,
           one listener handles all cards + carousel cards.
        ====================================================== */

        grid.addEventListener(
            "click",
            function (event) {

                const btn =
                    event.target.closest(
                        ".bb-ajax-cart"
                    );


                if (!btn) {
                    return;
                }


                event.preventDefault();


                addToCart(btn);

            }
        );


        /* =====================================================
           TOAST
        ====================================================== */

        function showToast(
            message,
            type
        ) {

            const container =
                document.getElementById(
                    "bb-toast-container"
                );


            if (!container) {
                return;
            }


            const toast =
                document.createElement(
                    "div"
                );


            toast.className =
                "bb-toast " + type;


            const messageSpan =
                document.createElement(
                    "span"
                );


            messageSpan.textContent =
                message;


            toast.appendChild(
                messageSpan
            );


            if (
                type === "success"
            ) {

                const cartLink =
                    document.createElement(
                        "a"
                    );


                cartLink.href =
                    cartUrl;


                cartLink.textContent =
                    "View Cart";


                cartLink.style.color =
                    "#fff";


                cartLink.style.textDecoration =
                    "underline";


                cartLink.style.fontWeight =
                    "700";


                cartLink.style.whiteSpace =
                    "nowrap";


                toast.appendChild(
                    cartLink
                );

            }


            const closeBtn =
                document.createElement(
                    "button"
                );


            closeBtn.className =
                "bb-toast-close";


            closeBtn.type =
                "button";


            closeBtn.innerHTML =
                '<i class="fa-solid fa-xmark"></i>';


            closeBtn.addEventListener(
                "click",
                function () {

                    toast.remove();

                }
            );


            toast.appendChild(
                closeBtn
            );


            container.appendChild(
                toast
            );


            setTimeout(
                function () {

                    if (
                        toast.parentElement
                    ) {

                        toast.remove();

                    }

                },
                5000
            );

        }


        /* =====================================================
           SEARCH OPEN
        ====================================================== */

        if (searchFab) {

            searchFab.addEventListener(
                "click",
                function () {

                    searchOverlay.classList.add(
                        "open"
                    );


                    searchFab.classList.add(
                        "active"
                    );


                    setTimeout(
                        function () {

                            if (searchInput) {

                                searchInput.focus();

                            }

                        },
                        50
                    );

                }
            );

        }


        /* =====================================================
           SEARCH CLOSE
        ====================================================== */

        if (searchClose) {

            searchClose.addEventListener(
                "click",
                function () {

                    searchOverlay.classList.remove(
                        "open"
                    );


                    if (searchFab) {

                        searchFab.classList.remove(
                            "active"
                        );

                    }


                    if (searchInput) {

                        searchInput.value = "";

                    }


                    renderProducts();

                }
            );

        }


        /* =====================================================
           SEARCH INPUT

           Small debounce so we don't rebuild Owl Carousel
           for every single keystroke immediately.
        ====================================================== */

        let searchTimer =
            null;


        if (searchInput) {

            searchInput.addEventListener(
                "input",
                function () {

                    clearTimeout(
                        searchTimer
                    );


                    searchTimer =
                        setTimeout(
                            function () {

                                renderProducts();

                            },
                            120
                        );

                }
            );

        }


        /* =====================================================
           CATEGORY FILTER
        ====================================================== */

        document
            .querySelectorAll(
                ".bb-cat-pill"
            )
            .forEach(
                function (pill) {

                    pill.addEventListener(
                        "click",
                        function () {

                            document
                                .querySelectorAll(
                                    ".bb-cat-pill"
                                )
                                .forEach(
                                    function (p) {

                                        p.classList.remove(
                                            "active"
                                        );

                                    }
                                );


                            pill.classList.add(
                                "active"
                            );


                            renderProducts();

                        }
                    );

                }
            );


        /* =====================================================
           GET ACTIVE CATEGORY
        ====================================================== */

        function getActiveCategory() {

            const active =
                document.querySelector(
                    ".bb-cat-pill.active"
                );


            if (!active) {

                return "all";

            }


            return (
                active.dataset.cat ||
                "all"
            ).toLowerCase();

        }


        /* =====================================================
           GET SEARCH QUERY
        ====================================================== */

        function getSearchQuery() {

            if (!searchInput) {

                return "";

            }


            return (
                searchInput.value ||
                ""
            )
                .toLowerCase()
                .trim();

        }


        /* =====================================================
           FILTER ORIGINAL PRODUCTS
        ====================================================== */

        function getVisibleProducts() {

            const category =
                getActiveCategory();


            const query =
                getSearchQuery();


            return productCards.filter(
                function (card) {

                    const cardCategory =
                        (
                            card.dataset.category ||
                            ""
                        ).toLowerCase();


                    const cardName =
                        (
                            card.dataset.name ||
                            ""
                        ).toLowerCase();


                    const categoryMatch =
                        category === "all" ||
                        cardCategory === category;


                    const searchMatch =
                        !query ||
                        cardName.includes(
                            query
                        );


                    return (
                        categoryMatch &&
                        searchMatch
                    );

                }
            );

        }


        /* =====================================================
           DESTROY OLD CAROUSELS
        ====================================================== */

        function destroyCarousels() {

            grid
                .querySelectorAll(
                    ".bb-trending-wrap"
                )
                .forEach(
                    function (wrapper) {

                        const owl =
                            wrapper.querySelector(
                                ".bb-trending-owl"
                            );


                        if (
                            owl &&
                            window.jQuery &&
                            jQuery(owl).hasClass(
                                "owl-loaded"
                            )
                        ) {

                            try {

                                jQuery(owl)
                                    .trigger(
                                        "destroy.owl.carousel"
                                    );

                            } catch (error) {

                                console.warn(
                                    "Owl destroy:",
                                    error
                                );

                            }

                        }


                        wrapper.remove();

                    }
                );

        }


        /* =====================================================
           CREATE PRODUCT CARD FOR CAROUSEL

           IMPORTANT:
           This creates a fresh lightweight card from
           dataset values.

           It does NOT clone the original DOM.
        ====================================================== */

        function createCarouselCard(
            sourceCard
        ) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "bb-pcard";


            const category =
                sourceCard.dataset.category ||
                "";


            const productName =
                sourceCard.dataset.product ||
                sourceCard.dataset.name ||
                "";


            const price =
                sourceCard.dataset.price ||
                "";


            const addUrl =
                sourceCard.dataset.addUrl ||
                "#";


            const image =
                sourceCard.dataset.image ||
                "";


            /* =================================================
               IMAGE
            ================================================== */

            const imageBox =
                document.createElement(
                    "div"
                );


            imageBox.className =
                "bb-pcard-img";


            if (image) {

                const img =
                    document.createElement(
                        "img"
                    );


                img.src =
                    image;


                img.alt =
                    productName;


                img.loading =
                    "lazy";


                img.decoding =
                    "async";


                img.width =
                    500;


                img.height =
                    500;


                imageBox.appendChild(
                    img
                );

            } else {

                const noImage =
                    document.createElement(
                        "div"
                    );


                noImage.className =
                    "bb-no-img";


                noImage.innerHTML =
                    '<i class="fa-solid fa-bowl-food"></i>';


                imageBox.appendChild(
                    noImage
                );

            }


            /* =================================================
               ADD BUTTON
            ================================================== */

            const addButton =
                document.createElement(
                    "a"
                );


            addButton.href =
                addUrl;


            addButton.className =
                "bb-pcard-pill bb-ajax-cart";


            addButton.dataset.product =
                productName;


            addButton.title =
                "Add " +
                productName +
                " to cart";


            addButton.innerHTML =
                '<span class="bb-pcard-pill-price">₹' +
                escapeHTML(price) +
                '</span>' +

                '<span class="bb-pcard-pill-btn">' +
                '<i class="fa-solid fa-plus"></i>' +
                '</span>';


            imageBox.appendChild(
                addButton
            );


            card.appendChild(
                imageBox
            );


            /* =================================================
               BODY
            ================================================== */

            const body =
                document.createElement(
                    "div"
                );


            body.className =
                "bb-pcard-body";


            const categoryElement =
                document.createElement(
                    "div"
                );


            categoryElement.className =
                "bb-pcard-cat";


            categoryElement.textContent =
                category;


            const nameElement =
                document.createElement(
                    "div"
                );


            nameElement.className =
                "bb-pcard-name";


            nameElement.title =
                productName;


            nameElement.textContent =
                productName;


            body.appendChild(
                categoryElement
            );


            body.appendChild(
                nameElement
            );


            card.appendChild(
                body
            );


            return card;

        }


        /* =====================================================
           ESCAPE HTML

           Only used for price string inside generated HTML.
        ====================================================== */

        function escapeHTML(value) {

            return String(value)
                .replace(
                    /&/g,
                    "&amp;"
                )
                .replace(
                    /</g,
                    "&lt;"
                )
                .replace(
                    />/g,
                    "&gt;"
                )
                .replace(
                    /"/g,
                    "&quot;"
                )
                .replace(
                    /'/g,
                    "&#039;"
                );

        }


        /* =====================================================
           BUILD TRENDING CAROUSEL
           
           RULE:
           After every 4 normal products,
           create one Owl carousel.

           Carousel gets up to 6 products starting from
           the next product.

           If fewer than 4 remain, it fills from beginning
           so Owl still has enough items to slide.
        ====================================================== */

        function buildTrendingCarousel(
            visibleProducts,
            insertAfterCardIndex
        ) {

            if (
                !window.jQuery ||
                !jQuery.fn.owlCarousel
            ) {

                console.warn(
                    "Owl Carousel is not loaded."
                );

                return;

            }


            const total =
                visibleProducts.length;


            let sliderProducts =
                [];


            /* =================================================
               START WITH PRODUCTS AFTER THE 4-CARD BLOCK
            ================================================== */

            for (
                let i = insertAfterCardIndex;
                i < total &&
                sliderProducts.length < 6;
                i++
            ) {

                sliderProducts.push(
                    visibleProducts[i]
                );

            }


            /* =================================================
               IF LESS THAN 4 REMAIN,
               FILL FROM BEGINNING
            ================================================== */

            if (
                sliderProducts.length < 4
            ) {

                for (
                    let i = 0;
                    i < total &&
                    sliderProducts.length < 6;
                    i++
                ) {

                    if (
                        !sliderProducts.includes(
                            visibleProducts[i]
                        )
                    ) {

                        sliderProducts.push(
                            visibleProducts[i]
                        );

                    }

                }

            }


            if (
                sliderProducts.length < 4
            ) {

                return;

            }


            /* =================================================
               WRAPPER
            ================================================== */

            const wrapper =
                document.createElement(
                    "div"
                );


            wrapper.className =
                "bb-trending-wrap";


            /* =================================================
               LABEL
            ================================================== */

            const label =
                document.createElement(
                    "div"
                );


            label.className =
                "bb-trending-label";


            label.textContent =
                "Trending now";


            wrapper.appendChild(
                label
            );


            /* =================================================
               OWL CONTAINER
            ================================================== */

            const owl =
                document.createElement(
                    "div"
                );


            owl.className =
                "bb-trending-owl owl-carousel owl-theme";


            /* =================================================
               CREATE FRESH CARDS
               
               NO cloneNode()
            ================================================== */

            sliderProducts.forEach(
                function (sourceCard) {

                    const carouselCard =
                        createCarouselCard(
                            sourceCard
                        );


                    owl.appendChild(
                        carouselCard
                    );

                }
            );


            wrapper.appendChild(
                owl
            );


            /* =================================================
               INSERT AFTER THE 4TH PRODUCT
            ================================================== */

            const previousCard =
                visibleProducts[
                    insertAfterCardIndex - 1
                ];


            if (
                previousCard &&
                previousCard.parentNode === grid
            ) {

                previousCard.after(
                    wrapper
                );

            } else {

                grid.appendChild(
                    wrapper
                );

            }


            /* =================================================
               OWL INITIALIZATION

               EXACTLY 3 CARDS VISIBLE
            ================================================== */

            jQuery(owl).owlCarousel({

                loop:
                    sliderProducts.length > 3,

                rewind:
                    false,

                margin:
                    10,

                nav:
                    true,

                dots:
                    true,

                autoplay:
                    true,

                autoplayTimeout:
                    3500,

                autoplayHoverPause:
                    true,

                smartSpeed:
                    450,

                slideBy:
                    1,

                touchDrag:
                    true,

                mouseDrag:
                    true,

                pullDrag:
                    true,

                freeDrag:
                    false,

                responsive: {

                    0: {
                        items: 3
                    },

                    480: {
                        items: 3
                    },

                    768: {
                        items: 3
                    },

                    1024: {
                        items: 3
                    },

                    1400: {
                        items: 3
                    }

                }

            });

        }


        /* =====================================================
           RENDER PRODUCTS

           This is now lightweight.

           It:
           1. destroys only existing Owl wrappers
           2. shows/hides original cards
           3. inserts fresh carousel cards
        ====================================================== */

        function renderProducts() {

            destroyCarousels();


            const visibleProducts =
                getVisibleProducts();


            /* =================================================
               HIDE / SHOW ORIGINAL CARDS
            ================================================== */

            productCards.forEach(
                function (card) {

                    card.style.display =
                        "none";

                }
            );


            visibleProducts.forEach(
                function (card) {

                    card.style.display =
                        "";

                }
            );


            /* =================================================
               EMPTY STATE
            ================================================== */

            if (
                visibleProducts.length === 0
            ) {

                emptyEl.classList.add(
                    "show"
                );

                emptyEl.style.display =
                    "block";


                return;

            }


            emptyEl.classList.remove(
                "show"
            );

            emptyEl.style.display =
                "none";


            /* =================================================
               BUILD CAROUSEL AFTER EVERY 4 PRODUCTS

               Example:

               Product 1
               Product 2
               Product 3
               Product 4

               Trending Owl

               Product 5
               Product 6
               Product 7
               Product 8

               Trending Owl
            ================================================== */

            for (
                let i = 4;
                i < visibleProducts.length;
                i += 4
            ) {

                const remaining =
                    visibleProducts.length -
                    i;


                if (
                    remaining <= 0
                ) {

                    continue;

                }


                buildTrendingCarousel(
                    visibleProducts,
                    i
                );

            }

        }


        /* =====================================================
           INITIAL RENDER
        ====================================================== */

        renderProducts();

    }

})();