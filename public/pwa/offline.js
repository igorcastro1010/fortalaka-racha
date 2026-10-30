document.getElementById('retry').addEventListener('click', () => window.location.reload());
function connected() {
  document.getElementById('connection').textContent = 'Conexão restaurada. Toque em TENTAR NOVAMENTE para voltar ao app.';
}
window.addEventListener('online', connected);
// A conexão pode voltar antes de o script terminar de carregar.
if (navigator.onLine) connected();
