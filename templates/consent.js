(() => {
  const CONSENT_GRANTED = 'granted';
  const CONSENT_DENIED = 'denied';
  const analyticsIdMeta = document.querySelector('meta[name="google-analytics-id"]');
  const analyticsMeasurementId = analyticsIdMeta?.content.trim().toUpperCase() || '';
  const isAnalyticsConfigured = /^G-[A-Z0-9]+$/i.test(analyticsMeasurementId);
  const storageKey = `zenithpress.analyticsConsent.${analyticsMeasurementId || 'default'}`;

  const consentModal = document.querySelector('[data-consent-modal]');
  const consentBackdrop = document.querySelector('[data-consent-backdrop]');
  const consentActionButtons = document.querySelectorAll('[data-consent-action]');
  const openConsentButtons = document.querySelectorAll('[data-open-consent]');
  const consentPrimaryButton = document.querySelector('[data-consent-action="accept"]');

  let analyticsConfigured = false;
  let analyticsLoadPromise = null;
  let consentModalMandatory = false;
  let consentState = null;

  const getStoredConsent = () => {
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      if (storedValue === CONSENT_GRANTED || storedValue === CONSENT_DENIED) {
        return storedValue;
      }
    } catch (error) {
      console.warn('Unable to read analytics consent preference.', error);
    }
    return null;
  };

  const setStoredConsent = (value) => {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch (error) {
      console.warn('Unable to store analytics consent preference.', error);
    }
  };

  const updateConsentUi = (value) => {
    document.documentElement.dataset.analyticsConsent = value || 'unset';
  };

  const setConsentModalState = (isOpen, { mandatory = false } = {}) => {
    if (!consentModal) return;
    consentModalMandatory = mandatory;

    if (isOpen) {
      consentModal.hidden = false;
      consentBackdrop?.setAttribute('hidden', '');
      consentModal.setAttribute('aria-hidden', 'false');
      window.requestAnimationFrame(() => {
        consentPrimaryButton?.focus();
      });
      return;
    }

    if (consentModal.contains(document.activeElement)) {
      document.activeElement.blur();
    }

    consentModal.hidden = true;
    consentBackdrop?.setAttribute('hidden', '');
    consentModal.setAttribute('aria-hidden', 'true');
  };

  const openConsentModal = (options = {}) => {
    if (!isAnalyticsConfigured) return;
    setConsentModalState(true, options);
  };

  const closeConsentModal = () => {
    if (consentModalMandatory) return;
    setConsentModalState(false);
  };

  const getConsentPayload = (analyticsStorage) => ({
    ad_storage: CONSENT_DENIED,
    ad_user_data: CONSENT_DENIED,
    ad_personalization: CONSENT_DENIED,
    analytics_storage: analyticsStorage
  });

  const applyAnalyticsConsent = (analyticsStorage) => {
    if (typeof window.gtag !== 'function' || !analyticsMeasurementId) return;
    window.gtag('consent', 'update', getConsentPayload(analyticsStorage));
  };

  const ensureGoogleAnalytics = (initialAnalyticsStorage = CONSENT_DENIED) => {
    if (!isAnalyticsConfigured) {
      return Promise.resolve(false);
    }

    if (!analyticsConfigured) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() {
        window.dataLayer.push(arguments);
      };

      window.gtag('consent', 'default', {
        ...getConsentPayload(CONSENT_DENIED),
        wait_for_update: 500
      });
      window.gtag('set', 'ads_data_redaction', true);

      if (initialAnalyticsStorage === CONSENT_GRANTED) {
        window.gtag('consent', 'update', getConsentPayload(CONSENT_GRANTED));
      }

      window.gtag('js', new Date());
      window.gtag('config', analyticsMeasurementId, {
        send_page_view: true
      });

      analyticsConfigured = true;
    }

    if (analyticsLoadPromise) {
      return analyticsLoadPromise;
    }

    analyticsLoadPromise = new Promise((resolve, reject) => {
      const analyticsScript = document.createElement('script');
      analyticsScript.async = true;
      analyticsScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsMeasurementId)}`;
      analyticsScript.addEventListener('load', () => resolve(true), { once: true });
      analyticsScript.addEventListener('error', () => reject(new Error('Failed to load Google Analytics.')), {
        once: true
      });
      document.head.append(analyticsScript);
    }).catch((error) => {
      analyticsLoadPromise = null;
      console.warn(error.message);
      return false;
    });

    return analyticsLoadPromise;
  };

  const handleConsentChoice = async (nextState) => {
    const previousState = consentState;
    consentState = nextState;
    setStoredConsent(nextState);
    updateConsentUi(nextState);
    setConsentModalState(false);

    const didLoadAnalytics = await ensureGoogleAnalytics(consentState);
    if (!didLoadAnalytics || previousState === nextState) return;
    applyAnalyticsConsent(nextState);
  };

  const initializeConsent = () => {
    consentState = getStoredConsent();
    updateConsentUi(consentState);

    openConsentButtons.forEach((button) => {
      button.hidden = !isAnalyticsConfigured;
    });

    if (!isAnalyticsConfigured) return;

    void ensureGoogleAnalytics(consentState);

    if (consentState === CONSENT_GRANTED || consentState === CONSENT_DENIED) {
      return;
    }

    openConsentModal({ mandatory: true });
  };

  consentActionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextState = button.dataset.consentAction === 'accept'
        ? CONSENT_GRANTED
        : CONSENT_DENIED;
      void handleConsentChoice(nextState);
    });
  });

  openConsentButtons.forEach((button) => {
    button.addEventListener('click', () => {
      openConsentModal();
    });
  });

  consentBackdrop?.addEventListener('click', closeConsentModal);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeConsentModal();
    }
  });

  initializeConsent();
})();
