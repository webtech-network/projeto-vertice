'use client';

import { useEffect } from 'react';

// Tooltip instantâneo global. O `title` nativo só aparece depois de ~1s parado
// sobre o elemento, o que torna botões só-ícone pouco descobríveis. Em vez de
// trocar cada `title="..."` do app por um componente, este listener delegado
// (montado uma vez no layout raiz) intercepta qualquer elemento com `title`:
// move o texto para `data-tip` (suprime o tooltip nativo), preserva o nome
// acessível via `aria-label` quando o elemento não tem texto próprio e exibe um
// balão imediatamente no hover/foco de teclado. Novos `title` funcionam sem
// nenhuma mudança adicional.
const GAP = 8;
const MARGIN = 8;

function adopt(el) {
  const text = el.getAttribute('title');
  if (text == null) return el.getAttribute('data-tip');
  el.removeAttribute('title');
  if (!text.trim()) return null;
  el.setAttribute('data-tip', text);
  if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && !el.textContent.trim()) {
    el.setAttribute('aria-label', text);
  }
  return text;
}

function findTarget(node) {
  if (!(node instanceof Element)) return null;
  const el = node.closest('[title], [data-tip]');
  if (!el || el.tagName === 'IFRAME') return null;
  return el;
}

export default function InstantTooltip() {
  useEffect(() => {
    const tip = document.createElement('div');
    tip.className = 'instant-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.appendChild(tip);

    let current = null;

    function hide() {
      current = null;
      tip.hidden = true;
    }

    function place(el) {
      const r = el.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      let left = r.left + r.width / 2 - t.width / 2;
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - t.width - MARGIN));
      let top = r.bottom + GAP;
      if (top + t.height > window.innerHeight - MARGIN) top = r.top - t.height - GAP;
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.max(MARGIN, top)}px`;
    }

    function show(el) {
      const text = adopt(el);
      if (!text) return hide();
      current = el;
      tip.textContent = text;
      tip.hidden = false;
      place(el);
    }

    function onOver(e) {
      if (e.pointerType === 'touch') return;
      const el = findTarget(e.target);
      if (!el) return hide();
      if (el === current && !el.hasAttribute('title')) return;
      show(el);
    }
    function onOut(e) {
      if (current && !current.contains(e.relatedTarget)) hide();
    }
    function onFocus(e) {
      const el = findTarget(e.target);
      if (el && e.target.matches?.(':focus-visible')) show(el);
    }
    function onKey(e) {
      if (e.key === 'Escape') hide();
    }

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', hide);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);

    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', hide);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      tip.remove();
    };
  }, []);

  return null;
}
