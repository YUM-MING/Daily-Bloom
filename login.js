// Login Component
import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase-config.js';

class AppLogin extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  setupListeners() {
      onAuthStateChanged(auth, (user) => {
          if (user) {
              this.dispatchEvent(new CustomEvent('login-success', { 
                  bubbles: true, 
                  composed: true, 
                  detail: user 
              }));
          } else {
              this.dispatchEvent(new CustomEvent('logout-success', { 
                  bubbles: true, 
                  composed: true 
              }));
          }
          this.render(user);
      });
  }

  async handleLogin() {
      try {
          await signInWithPopup(auth, provider);
      } catch (error) {
          console.error("Login failed", error);
      }
  }

  handleLogout() {
      signOut(auth);
  }

  render(user) {
    this.shadowRoot.innerHTML = `
      <style>
        @import url('/style.css');
        .login-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            text-align: center;
        }
        .profile {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
        }
      </style>
      ${!user ? `
          <div class="login-container">
            <h2>Welcome to Daily Bloom</h2>
            <p>Please sign in to continue.</p>
            <button class="btn-primary" id="login-btn">Sign in with Google</button>
          </div>
      ` : `
        <!-- Minimal profile view for header if needed, or just hidden -->
      `}
    `;

    const loginBtn = this.shadowRoot.getElementById('login-btn');
    if(loginBtn) loginBtn.addEventListener('click', () => this.handleLogin());
  }
}

customElements.define('app-login', AppLogin);
