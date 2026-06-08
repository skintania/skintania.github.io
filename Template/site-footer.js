class SiteFooter extends HTMLElement {
  async connectedCallback() {
    try {
      const res = await fetch('/Template/footer.html');
      this.innerHTML = await res.text();
    } catch (e) {
      console.error('Error loading footer:', e);
    }
  }
}
customElements.define('site-footer', SiteFooter);
