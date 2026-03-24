document.addEventListener("DOMContentLoaded", () => {
  const i18n = window.MERITSOURCE_I18N || null;
  const page = document.body.dataset.page || "home";
  const html = document.documentElement;
  const languageSelect = document.getElementById("language-select");
  const storageKey = "meritsource-language";
  const queryLanguage = new URLSearchParams(window.location.search).get("lang");
  let currentLanguage = "en";
  const contactDetails = {
    email: "1476080750@qq.com",
    whatsappDisplay: "+86 15875331576",
    whatsappUrl: "https://wa.me/8615875331576"
  };
  const inquiryStatusText = {
    en: {
      sending: "Sending inquiry...",
      success: "Inquiry submitted successfully. It has been saved to the local inquiry sheet and sent to email.",
      error: "Unable to submit the inquiry right now. Please try again later or contact us on WhatsApp."
    },
    zh: {
      sending: "正在提交询盘...",
      success: "询盘已提交成功，信息已保存到本地询盘表，并同步发送到邮箱。",
      error: "暂时无法提交询盘，请稍后重试，或直接通过 WhatsApp 联系。"
    }
  };

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  function setText(selector, value) {
    if (value === undefined) return;
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function setHTML(selector, value) {
    if (value === undefined) return;
    const element = document.querySelector(selector);
    if (element) element.innerHTML = value;
  }

  function setTexts(selector, values) {
    if (!Array.isArray(values)) return;
    document.querySelectorAll(selector).forEach((element, index) => {
      if (values[index] !== undefined) {
        element.textContent = values[index];
      }
    });
  }

  function setListItems(container, values) {
    const element = document.querySelector(container);
    if (!element || !Array.isArray(values)) return;
    element.innerHTML = values.map((item) => `<li>${item}</li>`).join("");
  }

  function setMeta(title, description) {
    if (title) document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && description) {
      meta.setAttribute("content", description);
    }
  }

  function setLabelText(label, text) {
    if (!label) return;
    const control = label.querySelector("input, select, textarea");
    if (!control) return;

    let span = label.querySelector(".i18n-label");
    if (!span) {
      span = document.createElement("span");
      span.className = "i18n-label";
      label.insertBefore(span, control);
    }

    label.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.remove();
      }
    });

    span.textContent = text;
  }

  function setPlaceholder(selector, value) {
    if (value === undefined) return;
    const element = document.querySelector(selector);
    if (element) element.setAttribute("placeholder", value);
  }

  function setOptions(selector, values) {
    if (!Array.isArray(values)) return;
    const options = document.querySelectorAll(`${selector} option`);
    options.forEach((option, index) => {
      if (values[index] !== undefined) option.textContent = values[index];
    });
  }

  function applyCommon(language) {
    if (!i18n) return;
    const pack = i18n.common[language] || i18n.common.en;
    setText(".brand small", pack.brandTag);
    setTexts(".nav a", pack.nav);
    setText(".site-footer .footer-inner > div:first-child", pack.footer[page]);
    html.lang = language === "zh" ? "zh-CN" : language;
    html.dir = language === "ar" ? "rtl" : "ltr";
    document.body.dataset.lang = language;
    if (languageSelect) languageSelect.value = language;
  }

  function applyHome(pack) {
    setText(".hero .eyebrow", pack.hero.eyebrow);
    setText(".hero h1", pack.hero.title);
    setText(".hero .lead", pack.hero.lead);
    setTexts(".hero-actions a", pack.hero.buttons);
    setTexts(".tag-list .tag", pack.hero.tags);
    setText(".mini-title", pack.hero.miniTitle);
    setTexts(".mini-list li", pack.hero.miniList);
    setText(".stat-panel .label", pack.hero.statLabel);
    setTexts(".stat-list li", pack.hero.statList);

    setTexts(".trust-grid .trust-item strong", pack.trust.titles);
    setTexts(".trust-grid .trust-item .muted", pack.trust.descs);

    const headers = document.querySelectorAll(".section-header");
    if (headers[0]) {
      headers[0].querySelector(".pill").textContent = pack.who.pill;
      headers[0].querySelector("h2").textContent = pack.who.title;
      headers[0].querySelector("p").textContent = pack.who.lead;
    }
    document.querySelectorAll(".card-grid.four")[0]?.querySelectorAll(".card").forEach((card, index) => {
      if (!pack.who.cards[index]) return;
      card.querySelector("h3").textContent = pack.who.cards[index][0];
      card.querySelector("p").textContent = pack.who.cards[index][1];
    });

    if (headers[1]) {
      headers[1].querySelector(".pill").textContent = pack.featured.pill;
      headers[1].querySelector("h2").textContent = pack.featured.title;
      headers[1].querySelector("p").textContent = pack.featured.lead;
    }
    const featuredGrid = document.querySelectorAll(".card-grid")[1];
    if (featuredGrid) {
      featuredGrid.classList.toggle("three", pack.featured.cards.length === 3);
      featuredGrid.classList.toggle("four", pack.featured.cards.length !== 3);
      featuredGrid.querySelectorAll(".product-card").forEach((card, index) => {
        const data = pack.featured.cards[index];
        if (!data) {
          card.style.display = "none";
          return;
        }
        card.style.display = "";
        card.querySelector("h3").textContent = data[0];
        card.querySelector("p").textContent = data[1];
        card.querySelector("a").textContent = data[2];
      });
    }

    const splitCards = document.querySelectorAll(".split-card");
    if (splitCards[0]) {
      splitCards[0].querySelector(".pill").textContent = pack.custom.pill;
      splitCards[0].querySelector("h2").textContent = pack.custom.title;
      splitCards[0].querySelector(".lead").textContent = pack.custom.lead;
      splitCards[0].querySelectorAll(".feature-box").forEach((box, index) => {
        if (!pack.custom.cards[index]) return;
        box.querySelector("h3").textContent = pack.custom.cards[index][0];
        box.querySelector("p").textContent = pack.custom.cards[index][1];
      });
      splitCards[0].querySelector(".btn-primary").textContent = pack.custom.button;
    }

    if (headers[2]) {
      headers[2].querySelector(".pill").textContent = pack.why.pill;
      headers[2].querySelector("h2").textContent = pack.why.title;
      headers[2].querySelector("p").textContent = pack.why.lead;
    }
    document.querySelectorAll(".stats-grid .stat").forEach((stat, index) => {
      if (!pack.why.stats[index]) return;
      stat.querySelector("strong").textContent = pack.why.stats[index][0];
      stat.querySelector(".muted").textContent = pack.why.stats[index][1];
    });

    const detailGrids = document.querySelectorAll(".detail-grid");
    if (detailGrids[1]) {
      const left = detailGrids[1].children[0];
      left.querySelector(".pill").textContent = pack.order.pill;
      left.querySelector("h2").textContent = pack.order.title;
      left.querySelector(".lead").textContent = pack.order.lead;
      left.querySelector(".banner-note").textContent = pack.order.note;
      left.querySelectorAll(".flow-node-label").forEach((label, index) => {
        if (!pack.order.steps[index]) return;
        label.textContent = pack.order.steps[index][0];
      });
      detailGrids[1].querySelectorAll(".process-item").forEach((item, index) => {
        if (!pack.order.steps[index]) return;
        item.querySelector("h3").textContent = pack.order.steps[index][0];
        item.querySelector("p").textContent = pack.order.steps[index][1];
      });
    }

    if (splitCards[1]) {
      splitCards[1].querySelector(".pill").textContent = pack.factory.pill;
      splitCards[1].querySelector("h2").textContent = pack.factory.title;
      splitCards[1].querySelector(".lead").textContent = pack.factory.lead;
      const factoryList = splitCards[1].querySelector("ul");
      if (factoryList) {
        factoryList.innerHTML = pack.factory.list.map((item) => `<li>${item}</li>`).join("");
      }
      splitCards[1].querySelector(".btn-secondary").textContent = pack.factory.button;
    }

    if (headers[3]) {
      headers[3].querySelector(".pill").textContent = pack.faq.pill;
      headers[3].querySelector("h2").textContent = pack.faq.title;
      headers[3].querySelector("p").textContent = pack.faq.lead;
    }
    document.querySelectorAll(".faq-grid .faq-item").forEach((item, index) => {
      if (!pack.faq.items[index]) return;
      item.querySelector("summary").textContent = pack.faq.items[index][0];
      item.querySelector("p").textContent = pack.faq.items[index][1];
    });

    const ctaPanel = document.querySelector(".cta-panel");
    if (ctaPanel) {
      ctaPanel.querySelector(".pill").textContent = pack.cta.pill;
      ctaPanel.querySelector("h2").textContent = pack.cta.title;
      ctaPanel.querySelector("p").textContent = pack.cta.lead;
      setTexts(".cta-panel .cta-actions a", pack.cta.buttons);
    }
  }

  function applyProducts(pack) {
    setText(".page-hero .eyebrow", pack.hero.eyebrow);
    setText(".page-hero h1", pack.hero.title);
    setText(".page-hero .lead", pack.hero.lead);

    const productGrid = document.querySelector(".products-page-grid, .card-grid.four, .card-grid.three");
    if (productGrid) {
      productGrid.classList.toggle("three", pack.cards.length === 3);
      productGrid.classList.toggle("four", pack.cards.length !== 3);
    }
    document.querySelectorAll(".product-card").forEach((card, index) => {
      const data = pack.cards[index];
      if (!data) {
        card.style.display = "none";
        return;
      }
      card.style.display = "";
      card.querySelector(".pill").textContent = data[0];
      card.querySelector("h3").textContent = data[1];
      card.querySelector("p").textContent = data[2];
      card.querySelectorAll("li").forEach((li, liIndex) => {
        if (data[3][liIndex]) li.textContent = data[3][liIndex];
      });
    });

    const split = document.querySelector(".split-card");
    if (split) {
      split.querySelector(".pill").textContent = pack.structure.pill;
      split.querySelector("h2").textContent = pack.structure.title;
      setListItems(".split-card ul", pack.structure.list);
      split.querySelector(".btn-primary").textContent = pack.structure.button;
    }

    const cta = document.querySelector(".cta-panel");
    if (cta) {
      cta.querySelector("h2").textContent = pack.cta.title;
      cta.querySelector("p").textContent = pack.cta.lead;
      setTexts(".cta-panel .cta-actions a", pack.cta.buttons);
    }
  }

  function applyCustom(pack) {
    setText(".page-hero .eyebrow", pack.hero.eyebrow);
    setText(".page-hero h1", pack.hero.title);
    setText(".page-hero .lead", pack.hero.lead);
    setTexts(".page-hero .hero-actions a", pack.hero.buttons);

    document.querySelectorAll(".card-grid.three .feature-box").forEach((box, index) => {
      const data = pack.boxes[index];
      if (!data) return;
      box.querySelector("h3").textContent = data[0];
      box.querySelectorAll("li").forEach((li, liIndex) => {
        if (data[1][liIndex]) li.textContent = data[1][liIndex];
      });
    });

    const split = document.querySelector(".split-card");
    if (split) {
      split.querySelector(".pill").textContent = pack.sampling.pill;
      split.querySelector("h2").textContent = pack.sampling.title;
      split.querySelector(".muted").textContent = pack.sampling.lead;
      setListItems(".detail-grid .split-card ul", pack.sampling.list);
    }

    document.querySelectorAll(".process-item").forEach((item, index) => {
      const data = pack.sampling.steps[index];
      if (!data) return;
      item.querySelector("h3").textContent = data[0];
      item.querySelector("p").textContent = data[1];
    });

    const cta = document.querySelector(".cta-panel");
    if (cta) {
      cta.querySelector("h2").textContent = pack.cta.title;
      cta.querySelector("p").textContent = pack.cta.lead;
      setTexts(".cta-panel .cta-actions a", pack.cta.buttons);
    }
  }

  function applyAbout(pack) {
    setText(".page-hero .eyebrow", pack.hero.eyebrow);
    setText(".page-hero h1", pack.hero.title);
    setText(".page-hero .lead", pack.hero.lead);

    const split = document.querySelector(".split-card");
    if (split) {
      split.querySelector(".pill").textContent = pack.story.pill;
      split.querySelector("h2").textContent = pack.story.title;
      split.querySelector(".muted").textContent = pack.story.lead;
      setListItems(".detail-grid .split-card ul", pack.story.list);
    }

    document.querySelectorAll(".card-grid.three .card").forEach((card, index) => {
      const data = pack.cards[index];
      if (!data) return;
      card.querySelector("h3").textContent = data[0];
      card.querySelector("p").textContent = data[1];
    });

    const cta = document.querySelector(".cta-panel");
    if (cta) {
      cta.querySelector("h2").textContent = pack.cta.title;
      cta.querySelector("p").textContent = pack.cta.lead;
      setTexts(".cta-panel .cta-actions a", pack.cta.buttons);
    }
  }

  function applyFaq(pack) {
    setText(".page-hero .eyebrow", pack.hero.eyebrow);
    setText(".page-hero h1", pack.hero.title);
    setText(".page-hero .lead", pack.hero.lead);

    document.querySelectorAll(".faq-grid .faq-item").forEach((item, index) => {
      const data = pack.items[index];
      if (!data) return;
      item.querySelector("summary").textContent = data[0];
      item.querySelector("p").textContent = data[1];
    });

    const cta = document.querySelector(".cta-panel");
    if (cta) {
      cta.querySelector("h2").textContent = pack.cta.title;
      cta.querySelector("p").textContent = pack.cta.lead;
      setTexts(".cta-panel .cta-actions a", pack.cta.buttons);
    }
  }

  function setupFaqAccordion() {
    if (page !== "faq") return;
    const items = document.querySelectorAll(".faq-grid .faq-item");
    items.forEach((item) => {
      const summary = item.querySelector("summary");
      if (!summary || summary.dataset.bound === "true") return;
      summary.dataset.bound = "true";
      summary.addEventListener("click", (event) => {
        event.preventDefault();
        const shouldOpen = !item.hasAttribute("open");
        items.forEach((other) => other.removeAttribute("open"));
        if (shouldOpen) item.setAttribute("open", "");
      });
    });
  }

  function applyContact(pack) {
    setText(".page-hero .eyebrow", pack.hero.eyebrow);
    setText(".page-hero h1", pack.hero.title);
    setText(".page-hero .lead", pack.hero.lead);

    const formCard = document.querySelector(".form-card");
    if (formCard) {
      formCard.querySelector(".pill").textContent = pack.form.pill;
      formCard.querySelector("h3").textContent = pack.form.title;
      formCard.querySelector(".muted").textContent = pack.form.lead;
    }

    const labels = document.querySelectorAll(".form-card form label");
    pack.form.labels.forEach((text, index) => setLabelText(labels[index], text));

    const inputs = document.querySelectorAll(".form-card input");
    setPlaceholder(".form-card input[type='text']", pack.form.placeholders[0]);
    if (inputs[1]) inputs[1].setAttribute("placeholder", pack.form.placeholders[1]);
    if (inputs[2]) inputs[2].setAttribute("placeholder", pack.form.placeholders[2]);
    if (inputs[3]) inputs[3].setAttribute("placeholder", pack.form.placeholders[3]);
    if (inputs[4]) inputs[4].setAttribute("placeholder", pack.form.placeholders[4]);
    if (inputs[5]) inputs[5].setAttribute("placeholder", pack.form.placeholders[5]);
    if (inputs[6]) inputs[6].setAttribute("placeholder", pack.form.placeholders[6]);
    setPlaceholder(".form-card textarea", pack.form.placeholders[7]);

    setOptions(".form-card select:nth-of-type(1)", pack.form.businessOptions);
    setOptions(".form-card select:nth-of-type(2)", pack.form.productOptions);
    setOptions(".form-card select:nth-of-type(3)", pack.form.logoOptions);

    const submitButton = document.querySelector(".form-card button[type='submit']");
    if (submitButton) {
      submitButton.textContent = pack.form.submit;
      submitButton.dataset.defaultLabel = pack.form.submit;
    }

    const contactCard = document.querySelector(".contact-card");
    if (contactCard) {
      contactCard.querySelector(".pill").textContent = pack.side.pill;
      contactCard.querySelector("h3").textContent = pack.side.title;
      contactCard.querySelectorAll("ul li").forEach((li, index) => {
        if (pack.side.list[index]) li.textContent = pack.side.list[index];
      });
      const directCard = contactCard.querySelector(".contact-direct-card");
      if (directCard) {
        if (pack.side.directTitle) directCard.querySelector("h3").textContent = pack.side.directTitle;
        if (pack.side.directLead) directCard.querySelector("p").textContent = pack.side.directLead;
        const emailLink = directCard.querySelector(".contact-email-link");
        const whatsappLink = directCard.querySelector(".contact-whatsapp-link");
        if (emailLink) {
          emailLink.textContent = contactDetails.email;
          emailLink.href = `mailto:${contactDetails.email}`;
        }
        if (whatsappLink) {
          whatsappLink.textContent = `WhatsApp: ${contactDetails.whatsappDisplay}`;
          whatsappLink.href = contactDetails.whatsappUrl;
        }
      }
      const recordsCard = contactCard.querySelector(".contact-records-card");
      if (recordsCard) {
        if (pack.side.recordsTitle) recordsCard.querySelector("h3").textContent = pack.side.recordsTitle;
        if (pack.side.recordsLead) recordsCard.querySelector("p").textContent = pack.side.recordsLead;
      }
      const whatsappCard = contactCard.querySelector(".contact-whatsapp-card");
      if (whatsappCard) {
        whatsappCard.querySelector("h3").textContent = pack.side.whatsappTitle;
        whatsappCard.querySelector("p").textContent = pack.side.whatsappLead;
        const whatsappButton = whatsappCard.querySelector("a");
        if (whatsappButton) {
          whatsappButton.textContent = pack.side.whatsappButton;
          whatsappButton.href = contactDetails.whatsappUrl;
        }
      }
    }
  }

  function setFormStatus(state, text) {
    const status = document.querySelector(".form-status");
    if (!status) return;
    status.textContent = text || "";
    status.dataset.state = state || "";
  }

  function setupContactForm() {
    if (page !== "contact") return;
    const form = document.querySelector(".form-card form");
    if (!form || form.dataset.bound === "true") return;
    form.dataset.bound = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const submitButton = form.querySelector("button[type='submit']");
      const endpoint = form.dataset.endpoint || "/api/inquiry";
      const statusPack = inquiryStatusText[currentLanguage] || inquiryStatusText.en;
      const payload = Object.fromEntries(new FormData(form).entries());

      try {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = statusPack.sending;
        }
        setFormStatus("sending", statusPack.sending);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || statusPack.error);
        }

        form.reset();
        setFormStatus("success", data.message || statusPack.success);
      } catch (error) {
        setFormStatus("error", error.message || statusPack.error);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = submitButton.dataset.defaultLabel || "Send Inquiry";
        }
      }
    });
  }

  function applyPage(language) {
    if (!i18n || !i18n.pages[page]) return;
    const pack =
      i18n.pages[page][language] ||
      i18n.pages[page].en?.[language] ||
      i18n.pages[page].en;
    setMeta(pack.title, pack.description);

    if (page === "home") applyHome(pack);
    if (page === "products") applyProducts(pack);
    if (page === "custom") applyCustom(pack);
    if (page === "about") applyAbout(pack);
    if (page === "faq") applyFaq(pack);
    if (page === "contact") applyContact(pack);
  }

  function applyLanguage(language) {
    currentLanguage = i18n?.common[language] ? language : "en";
    applyCommon(currentLanguage);
    applyPage(currentLanguage);
    setupFaqAccordion();
    setupContactForm();
    window.localStorage.setItem(storageKey, currentLanguage);
  }

  if (languageSelect) {
    const saved = queryLanguage || window.localStorage.getItem(storageKey) || "en";
    languageSelect.value = saved;
    languageSelect.addEventListener("change", (event) => {
      applyLanguage(event.target.value);
    });
  }

  applyLanguage(queryLanguage || window.localStorage.getItem(storageKey) || "en");

});
