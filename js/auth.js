document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const usuario = document.getElementById('usuario').value.trim();
        const contrasena = document.getElementById('contrasena').value;

        try {
            // Cargar usuarios desde la raíz
            const response = await fetch('data/usuarios.json');
            const usuarios = await response.json();
            
            const usuarioEncontrado = usuarios.find(u => 
                u.usuario === usuario && u.contrasena === contrasena
            );

            if (!usuarioEncontrado) {
                mostrarError('Usuario o contraseña incorrectos');
                return;
            }

            sessionStorage.setItem('usuarioActual', JSON.stringify(usuarioEncontrado));
            window.location.href = 'index.html';

        } catch (err) {
            console.error('Error en login:', err);
            mostrarError('Error al iniciar sesión. Intenta nuevamente.');
        }
    });

    function mostrarError(mensaje) {
        errorMessage.textContent = mensaje;
        errorMessage.classList.add('show');
        
        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 4000);
    }

    history.pushState(null, null, location.href);
    window.onpopstate = function () {
        history.go(1);
    };
});
