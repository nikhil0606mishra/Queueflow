/**
 * A row of mechanical "split-flap" digits, like a station departure board.
 * Call `new FlapBoard(container, digitCount)` once, then `.set(number)`
 * whenever the value changes — it only animates the digits that actually
 * changed.
 */
class FlapDigit {
  constructor(root) {
    this.root = root;
    this.face = root.querySelector('.flap-face');
    this.leaf = root.querySelector('.flap-leaf');
    this.leafInner = root.querySelector('.flap-leaf-inner');
    this.current = this.face.textContent;
  }

  set(value) {
    if (value === this.current) return;
    const previous = this.current;
    this.current = value;

    // Leaf starts showing the OLD digit, covering the top half.
    this.leafInner.textContent = previous;
    this.leaf.classList.remove('flipping');
    this.leaf.style.transform = 'rotateX(0deg)';
    // Force reflow so the animation restarts cleanly.
    // eslint-disable-next-line no-unused-expressions
    this.leaf.offsetHeight;

    // The static face updates immediately underneath the leaf.
    this.face.textContent = value;

    requestAnimationFrame(() => {
      this.leaf.classList.add('flipping');
    });

    const done = () => {
      this.leaf.classList.remove('flipping');
      this.leaf.removeEventListener('animationend', done);
    };
    this.leaf.addEventListener('animationend', done);
  }
}

class FlapBoard {
  constructor(container, digitCount) {
    this.container = container;
    this.digitCount = digitCount;
    this.digits = [];
    this._build();
  }

  _build() {
    this.container.innerHTML = '';
    for (let i = 0; i < this.digitCount; i += 1) {
      const flap = document.createElement('div');
      flap.className = 'flap';
      flap.innerHTML = `
        <div class="flap-face">0</div>
        <div class="flap-leaf"><div class="flap-leaf-inner">0</div></div>
      `;
      this.container.appendChild(flap);
      this.digits.push(new FlapDigit(flap));
    }
  }

  set(number) {
    const str = String(Math.max(0, Math.floor(number))).padStart(this.digitCount, '0');
    const chars = str.slice(-this.digitCount).split('');
    chars.forEach((char, i) => this.digits[i].set(char));
  }
}
