document.getElementById('retry').addEventListener('click', () => window.location.reload());
window.addEventListener('online', () => {
  document.getElementById('connection').textContent = 'Conexão restaurada. Toque em TENTAR NOVAMENTE para voltar ao app.';
});
