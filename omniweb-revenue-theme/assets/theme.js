/**
 * Omniweb Revenue Theme — JavaScript
 * Version: 1.0.0
 */

(function () {
  'use strict';

  /* ============================================================
     UTILITIES
     ============================================================ */
  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    var value = '';
    var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
    var formatString = format || window.moneyFormat || '${{amount}}';

    function defaultOption(opt, def) {
      return typeof opt === 'undefined' ? def : opt;
    }

    function formatWithDelimiters(number, precision, thousands, decimal) {
      precision = defaultOption(precision, 2);
      thousands = defaultOption(thousands, ',');
      decimal = defaultOption(decimal, '.');
      if (isNaN(number) || number == null) return 0;
      number = (number / 100.0).toFixed(precision);
      var parts = number.split('.');
      var dollarsAmount = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
      var centsAmount = parts[1] ? (decimal + parts[1]) : '';
      return dollarsAmount + centsAmount;
    }

    switch (formatString.match(placeholderRegex)[1]) {
      case 'amount': value = formatWithDelimiters(cents, 2); break;
      case 'amount_no_decimals': value = formatWithDelimiters(cents, 0); break;
      case 'amount_with_comma_separator': value = formatWithDelimiters(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': value = formatWithDelimiters(cents, 0, '.', ','); break;
    }
    return formatString.replace(placeholderRegex, value);
  }

  /* ============================================================
     CART API
     ============================================================ */
  var Cart = {
    getCart: function () {
      return fetch(window.routes.cart_url + '.js')
        .then(function (r) { return r.json(); });
    },
    addItem: function (variantId, quantity, properties) {
      var body = { id: variantId, quantity: quantity || 1 };
      if (properties) body.properties = properties;
      return fetch(window.routes.cart_add_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items: [body] })
      }).then(function (r) { return r.json(); });
    },
    changeItem: function (key, quantity) {
      return fetch(window.routes.cart_change_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: key, quantity: quantity })
      }).then(function (r) { return r.json(); });
    },
    updateCart: function (updates) {
      return fetch(window.routes.cart_update_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ updates: updates })
      }).then(function (r) { return r.json(); });
    }
  };

  /* ============================================================
     CART DRAWER
     ============================================================ */
  var cartDrawer = document.getElementById('cart-drawer');
  var overlay = document.getElementById('overlay');

  function openCartDrawer() {
    if (!cartDrawer) return;
    cartDrawer.classList.add('open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    refreshCartDrawer();
  }

  function closeCartDrawer() {
    if (!cartDrawer) return;
    cartDrawer.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function refreshCartDrawer() {
    Cart.getCart().then(function (cart) {
      updateCartCount(cart.item_count);
      updateCartDrawerBody(cart);
    });
  }

  function updateCartCount(count) {
    var counts = document.querySelectorAll('.js-cart-count');
    counts.forEach(function (el) {
      el.textContent = count;
      el.setAttribute('aria-hidden', count === 0 ? 'true' : 'false');
    });
    var btn = document.querySelector('[data-cart-count]');
    if (btn) btn.setAttribute('data-cart-count', count);
  }

  function updateCartDrawerBody(cart) {
    var body = document.querySelector('.js-cart-drawer-body');
    if (!body) return;

    var totalEl = document.querySelector('.js-cart-total');
    if (totalEl) totalEl.textContent = formatMoney(cart.total_price);

    // Update count displays
    var countEls = document.querySelectorAll('.js-cart-count');
    countEls.forEach(function (el) { el.textContent = cart.item_count; });
  }

  // Toggle cart
  document.addEventListener('click', function (e) {
    if (e.target.closest('.js-cart-toggle')) {
      if (cartDrawer && cartDrawer.classList.contains('open')) {
        closeCartDrawer();
      } else {
        openCartDrawer();
      }
    }
    if (e.target.closest('.js-cart-close')) closeCartDrawer();
  });

  /* ============================================================
     ADD TO CART
     ============================================================ */
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('.product__form');
    if (!form) return;
    e.preventDefault();

    var btn = form.querySelector('.js-add-to-cart');
    var btnText = btn.querySelector('.js-atc-text');
    var spinner = btn.querySelector('.product__add-btn-spinner');
    var variantInput = form.querySelector('[name="id"]');
    var quantityInput = form.querySelector('[name="quantity"]');

    if (!variantInput) return;

    var variantId = parseInt(variantInput.value, 10);
    var quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;

    btn.disabled = true;
    if (btnText) btnText.hidden = true;
    if (spinner) spinner.hidden = false;

    Cart.addItem(variantId, quantity)
      .then(function (result) {
        if (result.status === 422) {
          throw new Error(result.description || window.cartStrings.error);
        }
        if (btnText) { btnText.hidden = false; btnText.textContent = '✓ Added!'; }
        if (spinner) spinner.hidden = true;
        btn.disabled = false;

        // Open cart drawer or redirect
        if (window.routes && window.cartType === 'drawer') {
          openCartDrawer();
        } else {
          openCartDrawer();
        }

        // Reset text after 2 seconds
        setTimeout(function () {
          if (btnText) btnText.textContent = window.variantStrings ? window.variantStrings.addToCart : 'Add to cart';
        }, 2000);
      })
      .catch(function (err) {
        btn.disabled = false;
        if (btnText) { btnText.hidden = false; btnText.textContent = err.message || window.cartStrings.error; }
        if (spinner) spinner.hidden = true;
        console.warn('Add to cart error:', err);
      });
  });

  // Quick-add product card buttons
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.js-product-card-atc');
    if (!btn || btn.disabled) return;
    e.preventDefault();

    var variantId = parseInt(btn.dataset.variantId, 10);
    var original = btn.textContent.trim();
    btn.disabled = true;
    btn.textContent = '...';

    Cart.addItem(variantId, 1)
      .then(function () {
        btn.textContent = '✓ Added';
        openCartDrawer();
        setTimeout(function () {
          btn.textContent = original;
          btn.disabled = false;
        }, 2000);
      })
      .catch(function () {
        btn.textContent = 'Error';
        btn.disabled = false;
        setTimeout(function () { btn.textContent = original; }, 2000);
      });
  });

  /* ============================================================
     CART QUANTITY & REMOVE
     ============================================================ */
  document.addEventListener('click', function (e) {
    // Qty buttons
    var qtyBtn = e.target.closest('.js-cart-qty');
    if (qtyBtn) {
      var key = qtyBtn.dataset.key;
      var action = qtyBtn.dataset.action;
      var input = document.querySelector('.js-cart-qty-input[data-key="' + key + '"]');
      if (!input) return;
      var current = parseInt(input.value, 10);
      var newQty = action === 'increase' ? current + 1 : Math.max(0, current - 1);
      input.value = newQty;
      Cart.changeItem(key, newQty).then(function (cart) {
        updateCartCount(cart.item_count);
        updateCartDrawerBody(cart);
        if (newQty === 0) {
          var item = document.querySelector('[data-cart-item="' + key + '"], [data-key="' + key + '"]');
          if (item) {
            item.closest('.cart-drawer__item, .cart-item').remove();
          }
        }
      });
    }

    // Remove button
    var removeBtn = e.target.closest('.js-cart-remove');
    if (removeBtn) {
      var key = removeBtn.dataset.key;
      Cart.changeItem(key, 0).then(function (cart) {
        updateCartCount(cart.item_count);
        updateCartDrawerBody(cart);
        var item = document.querySelector('[data-cart-item="' + key + '"]');
        var drawerItem = document.querySelector('.cart-drawer__item[data-key="' + key + '"]');
        if (item) item.remove();
        if (drawerItem) drawerItem.remove();
      });
    }
  });

  /* ============================================================
     VARIANT PICKER
     ============================================================ */
  function initVariantPicker() {
    var containers = document.querySelectorAll('[data-product-id]');
    containers.forEach(function (container) {
      var sectionId = container.dataset.sectionId;
      var productData = null;
      var jsonEl = document.getElementById('product-json-' + sectionId);
      if (jsonEl) {
        try { productData = JSON.parse(jsonEl.textContent); } catch (e) {}
      }
      if (!productData) return;

      var variants = productData.variants;
      var select = container.querySelector('#variant-select-' + sectionId);
      var hiddenInput = container.querySelector('#hidden-variant-' + sectionId);
      var optionBtns = container.querySelectorAll('.product__option-btn');
      var priceEl = container.querySelector('#product-price');
      var skuEl = container.querySelector('#product-sku');
      var atcBtn = container.querySelector('.js-add-to-cart');
      var atcText = container.querySelector('.js-atc-text');
      var stickyBtn = document.querySelector('.js-sticky-atc-btn');

      // Collect selected options
      var selectedOptions = {};
      optionBtns.forEach(function (btn) {
        var idx = parseInt(btn.dataset.optionIndex, 10);
        if (btn.classList.contains('selected')) {
          selectedOptions[idx] = btn.dataset.value;
        }
      });

      function findVariant() {
        return variants.find(function (v) {
          return v.options.every(function (opt, idx) {
            return selectedOptions[idx] === undefined || selectedOptions[idx] === opt;
          });
        });
      }

      function updateUI(variant) {
        if (!variant) return;

        // Update hidden input & select
        if (hiddenInput) hiddenInput.value = variant.id;
        if (select) select.value = variant.id;

        // Update price
        if (priceEl) {
          var html = '';
          if (variant.compare_at_price > variant.price) {
            html = '<span class="product__price product__price--sale">' + formatMoney(variant.price) + '</span>' +
              '<s class="product__compare-price">' + formatMoney(variant.compare_at_price) + '</s>' +
              '<span class="badge badge--sale">Save ' + formatMoney(variant.compare_at_price - variant.price) + '</span>';
          } else {
            html = '<span class="product__price">' + formatMoney(variant.price) + '</span>';
          }
          priceEl.innerHTML = html;
        }

        // Update SKU
        if (skuEl) {
          skuEl.textContent = variant.sku ? 'SKU: ' + variant.sku : '';
        }

        // Update sticky price
        var stickyPrice = document.querySelector('.sticky-atc__price');
        if (stickyPrice) stickyPrice.textContent = formatMoney(variant.price);

        // Update ATC button
        if (atcBtn) {
          atcBtn.disabled = !variant.available;
          if (atcText) {
            atcText.textContent = variant.available
              ? (window.variantStrings ? window.variantStrings.addToCart : 'Add to cart')
              : (window.variantStrings ? window.variantStrings.soldOut : 'Sold out');
          }
        }
        if (stickyBtn) {
          stickyBtn.disabled = !variant.available;
        }

        // Update URL
        if (window.history && window.history.replaceState) {
          var url = new URL(window.location);
          url.searchParams.set('variant', variant.id);
          window.history.replaceState({}, '', url);
        }
      }

      optionBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.classList.contains('disabled')) return;
          var idx = parseInt(btn.dataset.optionIndex, 10);
          var value = btn.dataset.value;

          // Deselect siblings
          container.querySelectorAll('.product__option-btn[data-option-index="' + idx + '"]').forEach(function (b) {
            b.classList.remove('selected');
          });
          btn.classList.add('selected');
          selectedOptions[idx] = value;

          // Update displayed option value
          var labelVal = container.querySelector('.js-selected-option[data-option-index="' + idx + '"]');
          if (labelVal) labelVal.textContent = value;

          var variant = findVariant();
          updateUI(variant);
        });
      });
    });
  }

  /* ============================================================
     PRODUCT MEDIA GALLERY
     ============================================================ */
  function initProductGallery() {
    var galleries = document.querySelectorAll('#product-media-gallery');
    galleries.forEach(function (gallery) {
      var thumbnails = gallery.querySelectorAll('.product__thumbnail');
      var items = gallery.querySelectorAll('.product__media-item');

      thumbnails.forEach(function (thumb) {
        thumb.addEventListener('click', function () {
          var id = thumb.dataset.thumbnailId;

          thumbnails.forEach(function (t) { t.classList.remove('product__thumbnail--active'); });
          thumb.classList.add('product__thumbnail--active');

          items.forEach(function (item) {
            item.classList.remove('product__media-item--active');
            if (item.dataset.mediaId === id) {
              item.classList.add('product__media-item--active');
            }
          });
        });
      });
    });
  }

  /* ============================================================
     QUANTITY SELECTOR
     ============================================================ */
  document.addEventListener('click', function (e) {
    var plus = e.target.closest('.js-quantity-plus');
    var minus = e.target.closest('.js-quantity-minus');
    if (plus || minus) {
      var wrap = (plus || minus).closest('.quantity-selector');
      var input = wrap.querySelector('.quantity-selector__input');
      if (!input) return;
      var val = parseInt(input.value, 10) || 1;
      var max = parseInt(input.max, 10);
      var min = parseInt(input.min, 10) || 1;
      if (plus) { input.value = isNaN(max) ? val + 1 : Math.min(val + 1, max); }
      if (minus) { input.value = Math.max(val - 1, min); }
    }
  });

  /* ============================================================
     STICKY ATC
     ============================================================ */
  function initStickyATC() {
    var stickyAtc = document.querySelector('.js-sticky-atc');
    var productForm = document.querySelector('.product__form');
    if (!stickyAtc || !productForm) return;

    var stickyBtn = document.querySelector('.js-sticky-atc-btn');
    if (stickyBtn) {
      stickyBtn.addEventListener('click', function () {
        var formBtn = productForm.querySelector('.js-add-to-cart');
        if (formBtn) formBtn.click();
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        stickyAtc.hidden = entry.isIntersecting;
      });
    }, { threshold: 0.5 });

    var atcBtn = productForm.querySelector('.product__add-btn');
    if (atcBtn) observer.observe(atcBtn);
  }

  /* ============================================================
     FAQ ACCORDION
     ============================================================ */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.faq__question');
    if (!btn) return;

    var isExpanded = btn.getAttribute('aria-expanded') === 'true';
    var answerId = btn.getAttribute('aria-controls');
    var answer = document.getElementById(answerId);

    btn.setAttribute('aria-expanded', (!isExpanded).toString());
    if (answer) answer.hidden = isExpanded;
  });

  /* ============================================================
     MOBILE MENU
     ============================================================ */
  var mobileNav = document.querySelector('.js-mobile-nav');

  document.addEventListener('click', function (e) {
    if (e.target.closest('.js-mobile-menu-toggle')) {
      var isOpen = mobileNav && mobileNav.classList.contains('open');
      if (mobileNav) {
        mobileNav.classList.toggle('open');
        mobileNav.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
      }
      if (overlay) overlay.classList.toggle('active', !isOpen);
      document.body.style.overflow = isOpen ? '' : 'hidden';
    }
  });

  /* ============================================================
     SEARCH TOGGLE
     ============================================================ */
  var searchBar = document.querySelector('.js-search-bar');

  document.addEventListener('click', function (e) {
    if (e.target.closest('.js-search-toggle')) {
      if (searchBar) {
        var isHidden = searchBar.hidden;
        searchBar.hidden = !isHidden;
        if (!isHidden) return;
        setTimeout(function () {
          var input = searchBar.querySelector('.header__search-input');
          if (input) input.focus();
        }, 100);
      }
    }
  });

  /* ============================================================
     FILTER SIDEBAR
     ============================================================ */
  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('.js-filter-toggle');
    if (toggle) {
      var sidebar = document.querySelector('.js-filter-sidebar');
      if (sidebar) {
        sidebar.classList.toggle('open');
        toggle.setAttribute('aria-expanded', sidebar.classList.contains('open').toString());
      }
    }

    var groupToggle = e.target.closest('.js-filter-toggle-group');
    if (groupToggle) {
      var isExpanded = groupToggle.getAttribute('aria-expanded') !== 'false';
      groupToggle.setAttribute('aria-expanded', (!isExpanded).toString());
      var body = groupToggle.nextElementSibling;
      if (body) body.style.display = isExpanded ? 'none' : '';
    }
  });

  // Sort dropdown
  var sortSelect = document.querySelector('.js-sort-by');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      var url = new URL(window.location);
      url.searchParams.set('sort_by', sortSelect.value);
      window.location = url.toString();
    });
  }

  // Filter checkboxes auto-submit
  document.addEventListener('change', function (e) {
    var checkbox = e.target.closest('.js-filter-checkbox');
    if (!checkbox) return;
    var url = new URL(window.location);

    if (checkbox.checked) {
      url.searchParams.append(checkbox.name, checkbox.value);
    } else {
      var values = url.searchParams.getAll(checkbox.name).filter(function (v) { return v !== checkbox.value; });
      url.searchParams.delete(checkbox.name);
      values.forEach(function (v) { url.searchParams.append(checkbox.name, v); });
    }
    window.location = url.toString();
  });

  /* ============================================================
     SCROLL ANIMATIONS
     ============================================================ */
  function initScrollAnimations() {
    if (!document.body.classList.contains('animations-enabled')) return;
    var elements = document.querySelectorAll('.animate-on-scroll');
    if (!elements.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    elements.forEach(function (el) { observer.observe(el); });
  }

  /* ============================================================
     QUICK VIEW
     ============================================================ */
  var quickView = document.getElementById('quick-view-modal');

  function openQuickView() {
    if (!quickView) return;
    quickView.classList.add('open');
    quickView.setAttribute('aria-hidden', 'false');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeQuickView() {
    if (!quickView) return;
    quickView.classList.remove('open');
    quickView.setAttribute('aria-hidden', 'true');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('.js-quick-view-close')) closeQuickView();
  });

  /* ============================================================
     SKIP TO CONTENT
     ============================================================ */
  var skipLink = document.querySelector('[href="#main-content"]');
  if (skipLink) {
    skipLink.addEventListener('click', function (e) {
      e.preventDefault();
      var main = document.getElementById('main-content');
      if (main) { main.tabIndex = -1; main.focus(); }
    });
  }

  /* ============================================================
     INIT
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    initVariantPicker();
    initProductGallery();
    initStickyATC();
    initScrollAnimations();
  });

})();
