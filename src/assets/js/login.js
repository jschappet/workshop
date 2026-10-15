document.addEventListener('alpine:init', () => {
  Alpine.data('workshopLogin', () => ({
    username: '', password: '', busy: false, signedIn: false, message: '',
    async checkSession() {
      try {
        const profile = await Alpine.store('api').call('profile_json');
        this.signedIn = profile.authenticated;
      } catch { this.message = 'Sign in to continue.'; }
    },
    async login() {
      this.busy = true;
      this.message = '';
      try {
        await Alpine.store('api').call('login', {}, new URLSearchParams({
          username: this.username, password: this.password
        }));
        this.password = '';
        window.location.assign('/metrics/');
      } catch {
        this.message = 'Unable to sign in. Check your username and password and try again.';
      } finally { this.busy = false; }
    },
    async logout() {
      this.busy = true;
      try {
        await Alpine.store('api').call('logout');
        this.signedIn = false;
        this.password = '';
        this.message = 'Signed out.';
      } catch { this.message = 'Unable to sign out. Please try again.'; }
      finally { this.busy = false; }
    }
  }));
});
