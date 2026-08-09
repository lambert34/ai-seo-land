document.querySelectorAll('.article-filter[data-filter]').forEach((filter) => {
  filter.addEventListener('click', () => {
    const category = filter.dataset.filter;

    document.querySelectorAll('.article-filter[data-filter]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button === filter));
    });

    document.querySelectorAll('.article-card[data-category]').forEach((card) => {
      card.hidden = category !== 'all' && card.dataset.category !== category;
    });
  });
});
