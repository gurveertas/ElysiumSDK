import { getConfig } from '../config/index.js';
import { gatewayRegistry } from '../gateways/GatewayRegistry.js';
import { logger } from '../utils/logger.js';

let isListening = false;
let observer = null;
const debouncedButtons = new WeakMap();
const DEBOUNCE_DELAY_MS = 1500;

/**
 * Check if an element matches the configured payment button selectors
 */
export function isPaymentButton(target, selector) {
  if (!target || typeof target.closest !== 'function') return null;
  return target.closest(selector);
}

/**
 * Handle a detected payment button click
 */
export async function handleButtonClickEvent(event, customSelector = null) {
  const config = getConfig();
  const selector = customSelector || config.buttonSelector || '.elysium-payment-button';

  const button = isPaymentButton(event.target, selector);
  if (!button) return;

  // Prevent duplicate accidental double-clicks within debounce window
  const lastClick = debouncedButtons.get(button);
  const now = Date.now();
  if (lastClick && now - lastClick < DEBOUNCE_DELAY_MS) {
    logger.debug('Ignoring rapid double-click on payment button');
    return;
  }
  debouncedButtons.set(button, now);

  // Extract contextual information from the button and any surrounding form
  const context = {
    buttonId: button.id || null,
    buttonClasses: button.className || null,
    buttonText: button.innerText?.trim() || null,
    gatewayAttribute: button.dataset?.gateway || null,
    amount: button.dataset?.amount ? Number.parseFloat(button.dataset.amount) : null,
    currency: button.dataset?.currency || null,
    productId: button.dataset?.productId || null,
  };

  const form = button.closest('form');
  if (form) {
    context.formId = form.id || null;
    context.formAction = form.action || null;
  }

  // Resolve associated payment gateway
  const gateway = gatewayRegistry.resolveForButton(button);
  logger.info(`Detected payment button interaction for gateway [${gateway.name}]:`, context);

  // Trigger gateway attempt handler (NOTE: Button click is intent/attempt, NOT payment proof!)
  try {
    await gateway.handleButtonClick(button, context);
  } catch (err) {
    logger.error(`Error in ${gateway.name} handleButtonClick:`, err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('elysium:payment_attempt', {
        detail: { gateway: gateway.name, button, context },
      })
    );
  }
}

/**
 * Initialize payment button detection with delegated event listening and MutationObserver
 */
export function initPaymentButtonDetection(customSelector = null) {
  if (typeof document === 'undefined') return () => {};

  const config = getConfig();
  const selector = customSelector || config.buttonSelector || '.elysium-payment-button';

  if (!isListening) {
    // Delegated click listener handles dynamically mounted buttons automatically
    const clickHandler = (event) => handleButtonClickEvent(event, selector);
    document.addEventListener('click', clickHandler, { capture: true, passive: true });
    isListening = true;

    // MutationObserver to detect when payment buttons appear in DOM
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const matched = node.matches?.(selector) ? [node] : Array.from(node.querySelectorAll?.(selector) || []);
              if (matched.length > 0) {
                logger.debug(`MutationObserver detected ${matched.length} new payment button(s) dynamically`);
                matched.forEach((btn) => {
                  window.dispatchEvent(
                    new CustomEvent('elysium:button_detected', { detail: { button: btn } })
                  );
                });
              }
            }
          }
        }
      });

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    logger.debug(`Payment button detector initialized with selector: "${selector}"`);

    return () => {
      document.removeEventListener('click', clickHandler, { capture: true });
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      isListening = false;
    };
  }

  return () => {};
}
