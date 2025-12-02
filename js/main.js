document.addEventListener('DOMContentLoaded', async function() {
    const usuarioActual = JSON.parse(sessionStorage.getItem('usuarioActual'));
    
    if (!usuarioActual) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('userName').textContent = usuarioActual.nombre;
    document.getElementById('welcomeMessage').textContent = `Bienvenido, ${usuarioActual.nombre}`;

    if (usuarioActual.rol === 'admin') {
        document.getElementById('btnAdminResults').style.display = 'block';
    }

    const universidades = [
        { codigo: 'EPN', nombre: 'Escuela Politécnica Nacional', logo: 'assets/logos/epn.png' },
        { codigo: 'UCE', nombre: 'Universidad Central del Ecuador', logo: 'assets/logos/uce.png' },
        { codigo: 'ESPE', nombre: 'Universidad de las Fuerzas Armadas', logo: 'assets/logos/espe.png' },
        { codigo: 'UNACH', nombre: 'Universidad Nacional de Chimborazo', logo: 'assets/logos/unach.png' },
        { codigo: 'UPEC', nombre: 'Universidad Politécnica Estatal del Carchi', logo: 'assets/logos/upec.png' },
        { codigo: 'UTA', nombre: 'Universidad Técnica de Ambato', logo: 'assets/logos/uta.png' },
        { codigo: 'UTC', nombre: 'Universidad Técnica de Cotopaxi', logo: 'assets/logos/utc.png' },
        { codigo: 'UTN', nombre: 'Universidad Técnica del Norte', logo: 'assets/logos/utn.png' },
        { codigo: 'YACHAY', nombre: 'Universidad Yachay Tech', logo: 'assets/logos/yachay.png' }
    ];

    renderUniversidades(universidades, usuarioActual);

    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
    document.getElementById('btnAdminResults')?.addEventListener('click', () => {
        window.location.href = 'admin-resultados.html';
    });

    const modal = document.getElementById('modalNoAcceso');
    const closeModal = document.querySelector('.close-modal');
    const btnModalAccept = document.querySelector('.btn-modal-accept');

    closeModal.addEventListener('click', () => modal.style.display = 'none');
    btnModalAccept.addEventListener('click', () => modal.style.display = 'none');

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    history.pushState(null, null, location.href);
    window.onpopstate = function () {
        history.go(1);
    };
});

function renderUniversidades(universidades, usuario) {
    const grid = document.getElementById('universidadesGrid');
    
    universidades.forEach(uni => {
        const card = document.createElement('div');
        card.className = 'universidad-card';
        card.innerHTML = `
            <div class="universidad-logo-container">
                <img src="${uni.logo}" alt="${uni.nombre}" class="universidad-logo">
            </div>
            <div class="universidad-nombre">${uni.nombre}</div>
            <div class="universidad-codigo">${uni.codigo}</div>
        `;
        
        card.addEventListener('click', () => verificarAcceso(uni.codigo, usuario));
        grid.appendChild(card);
    });
}

function verificarAcceso(codigoUni, usuario) {
    const tieneAcceso = usuario.universidades_acceso.includes(codigoUni);
    
    if (tieneAcceso || usuario.rol === 'admin') {
        window.location.href = `universidades/${codigoUni}/simulador.html?uni=${codigoUni}`;
    } else {
        document.getElementById('modalNoAcceso').style.display = 'block';
    }
}

function cerrarSesion() {
    sessionStorage.removeItem('usuarioActual');
    window.location.href = 'login.html';
}
