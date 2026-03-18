/* ── TEXT-TO-SPEECH ENGINE ── Logical Learning ── */
/* Adds 🔊 Read Aloud buttons to concept cards and quiz questions */

(function () {
  'use strict';

  let currentUtterance = null;
  let activeBtn = null;

  /* ── Extract readable text from an element, stripping HTML tags ── */
  function extractText(el) {
    // Clone so we don't mutate the DOM
    const clone = el.cloneNode(true);
    // Remove buttons and speaker icons we injected
    clone.querySelectorAll('.tts-btn, .tts-quiz-btn').forEach(b => b.remove());
    // Convert tables to readable sentences
    clone.querySelectorAll('table').forEach(table => {
      const rows = table.querySelectorAll('tr');
      let text = '';
      rows.forEach((row, i) => {
        if (i === 0) return; // skip header
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          text += cells[0].textContent.trim() + ': ' + Array.from(cells).slice(1).map(c => c.textContent.trim()).join('. ') + '. ';
        }
      });
      const span = document.createElement('span');
      span.textContent = text;
      table.replaceWith(span);
    });
    // Get the text
    let raw = clone.textContent || '';
    // Clean up whitespace
    raw = raw.replace(/\s+/g, ' ').trim();
    // Clean up emoji for speech (keep them, most TTS engines skip them)
    return raw;
  }

  /* ── Stop any active speech ── */
  function stopSpeech() {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    if (activeBtn) {
      activeBtn.classList.remove('speaking');
      activeBtn.innerHTML = '🔊';
      activeBtn.title = 'Read aloud';
      activeBtn = null;
    }
    currentUtterance = null;
  }

  /* ── Speak text with a button toggle ── */
  function speak(text, btn) {
    // If this button is already speaking, stop
    if (activeBtn === btn && window.speechSynthesis.speaking) {
      stopSpeech();
      return;
    }
    // Stop any other active speech
    stopSpeech();

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92;
    utter.pitch = 1;
    utter.volume = 1;

    // Try to pick a good English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Microsoft'))
    ) || voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utter.voice = preferred;

    // Visual feedback
    btn.classList.add('speaking');
    btn.innerHTML = '⏹';
    btn.title = 'Stop reading';
    activeBtn = btn;
    currentUtterance = utter;

    utter.onend = function () {
      btn.classList.remove('speaking');
      btn.innerHTML = '🔊';
      btn.title = 'Read aloud';
      activeBtn = null;
      currentUtterance = null;
    };
    utter.onerror = utter.onend;

    // Chrome bug: long utterances cut off. Workaround: keep-alive interval.
    let keepAlive = setInterval(() => {
      if (!window.speechSynthesis.speaking) { clearInterval(keepAlive); return; }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10000);
    utter.onend = function () {
      clearInterval(keepAlive);
      btn.classList.remove('speaking');
      btn.innerHTML = '🔊';
      btn.title = 'Read aloud';
      activeBtn = null;
    };
    utter.onerror = utter.onend;

    window.speechSynthesis.speak(utter);
  }

  /* ── Create a speaker button ── */
  function createBtn(className) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.innerHTML = '🔊';
    btn.title = 'Read aloud';
    btn.type = 'button';
    return btn;
  }

  /* ── Inject buttons into concept cards ── */
  function injectConceptButtons() {
    document.querySelectorAll('.concept-card').forEach(card => {
      if (card.querySelector('.tts-btn')) return; // already injected

      const header = card.querySelector('.concept-header');
      const body = card.querySelector('.concept-body');
      if (!header || !body) return;

      const btn = createBtn('tts-btn');
      // Insert before the chevron
      const chevron = header.querySelector('.concept-chevron');
      if (chevron) header.insertBefore(btn, chevron);
      else header.appendChild(btn);

      btn.addEventListener('click', function (e) {
        e.stopPropagation(); // Don't toggle the card open/closed

        // Build text: title + subtitle + body content
        const title = card.querySelector('.concept-title')?.textContent || '';
        const subtitle = card.querySelector('.concept-subtitle')?.textContent || '';
        const bodyText = extractText(body);
        const fullText = title + '. ' + subtitle + '. ' + bodyText;

        // Make sure card is open so user can follow along
        if (!card.classList.contains('open')) {
          header.click();
        }

        speak(fullText, btn);
      });
    });
  }

  /* ── Inject buttons into quiz questions ── */
  function injectQuizButtons() {
    document.querySelectorAll('.quiz-card').forEach(card => {
      if (card.querySelector('.tts-quiz-btn')) return;

      const qText = card.querySelector('.q-text');
      if (!qText) return;

      const btn = createBtn('tts-quiz-btn');
      qText.parentElement.insertBefore(btn, qText);

      btn.addEventListener('click', function (e) {
        e.stopPropagation();

        // Read question + all options
        let text = qText.textContent;
        const opts = card.querySelectorAll('.opt');
        opts.forEach(o => { text += ' ' + o.textContent + '. '; });

        // If explanation is showing, read that too
        const exp = card.querySelector('.explanation.show');
        if (exp) text += ' Explanation: ' + exp.textContent;

        speak(text, btn);
      });
    });
  }

  /* ── Observe for dynamically built quiz cards ── */
  const observer = new MutationObserver(() => {
    injectQuizButtons();
  });

  /* ── Init ── */
  function init() {
    // Ensure voices are loaded (some browsers load async)
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {}, { once: true });
    }

    injectConceptButtons();
    injectQuizButtons();

    // Watch quiz container for rebuilds (retake quiz)
    const quizContainer = document.getElementById('quizContainer');
    if (quizContainer) {
      observer.observe(quizContainer, { childList: true });
    }

    // Stop speech on page unload
    window.addEventListener('beforeunload', stopSpeech);
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
