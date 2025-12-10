let usuarioActual = null;
let todosUsuarios = [];
let todosIntentos = [];
let materiasDisponibles = new Set();

// Materias por universidad (simulando estructura de cada universidad)
const materiasPorUniversidad = {
    'EPN': ['Matemáticas', 'Física', 'Química', 'Lengua'],
    'UCE': ['Matemáticas', 'Física', 'Química', 'Lengua'],
    'ESPE': ['Matemáticas', 'Física', 'Química', 'Lengua'],
    'UNACH': ['Matemáticas', 'Física', 'Química', 'Lengua'],
    'UPEC': ['Matemáticas', 'Física', 'Química'],
    'UTA': ['Matemáticas', 'Física', 'Química', 'Lengua'],
    'UTC': ['Matemáticas', 'Física', 'Química', 'Lengua'],
    'UTN': ['Matemáticas', 'Física', 'Química', 'Lengua'],
    'YACHAY': ['Matemáticas', 'Física', 'Química', 'Lengua']
};

document.addEventListener('DOMContentLoaded', async function () {
    usuarioActual = JSON.parse(sessionStorage.getItem('usuarioActual'));

    if (!usuarioActual || usuarioActual.rol !== 'admin') {
        alert('Acceso denegado. Solo administradores pueden ver esta página.');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('userName').textContent = usuarioActual.nombre;

    const headerContent = document.getElementById('headerContent');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    hamburgerBtn.addEventListener('click', () => {
        headerContent.classList.toggle('nav-open');
    });

    document.getElementById('btnVolver').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);

    // Listeners de filtros
    document.getElementById('filtroUniversidad').addEventListener('change', filtrarResultados);
    document.getElementById('filtroMateria').addEventListener('change', filtrarResultados);
    document.getElementById('buscarNombre').addEventListener('input', filtrarResultados);

    // Listener para cambio de universidad (actualiza materias)
    document.getElementById('filtroUniversidad').addEventListener('change', actualizarMaterias);

    await cargarDatos();
});

async function cargarDatos() {
    try {
        // Cargar usuarios del JSON
        const responseUsuarios = await fetch('data/usuarios.json');
        todosUsuarios = await responseUsuarios.json();

        // Cargar intentos de Supabase
        const { data: intentos, error } = await supabaseClient
            .from('intentos')
            .select('*')
            .order('tiempo_fin', { ascending: false });

        if (error) throw error;

        todosIntentos = intentos || [];

        // Recopilar todas las materias
        todosIntentos.forEach(intento => {
            materiasDisponibles.add(intento.materia_nombre);
        });

        actualizarMaterias();
        mostrarResultados();
    } catch (error) {
        console.error('Error al cargar datos:', error);
        mostrarMensajeVacio('❌ Error al cargar datos', 'Intenta recargar la página.');
    }
}

function actualizarMaterias() {
    const universidadSeleccionada = document.getElementById('filtroUniversidad').value;
    const selectMateria = document.getElementById('filtroMateria');
    
    selectMateria.innerHTML = '<option value="TODAS">Todas las Materias</option>';

    let materias = [];

    if (universidadSeleccionada === 'TODAS') {
        // Todas las materias únicas
        materias = [...new Set(Object.values(materiasPorUniversidad).flat())];
    } else {
        // Materias de la universidad seleccionada
        materias = materiasPorUniversidad[universidadSeleccionada] || [];
    }

    materias.forEach(materia => {
        const option = document.createElement('option');
        option.value = materia;
        option.textContent = materia;
        selectMateria.appendChild(option);
    });
}

function filtrarResultados() {
    mostrarResultados();
}

function mostrarResultados() {
    const universidadFiltro = document.getElementById('filtroUniversidad').value;
    const materiaFiltro = document.getElementById('filtroMateria').value;
    const nombreFiltro = document.getElementById('buscarNombre').value.toLowerCase().trim();

    // Filtrar estudiantes (excluir admins)
    let estudiantesFiltrados = todosUsuarios.filter(u => u.rol === 'estudiante');

    // Filtrar por universidad
    if (universidadFiltro !== 'TODAS') {
        estudiantesFiltrados = estudiantesFiltrados.filter(estudiante =>
            estudiante.universidades_acceso.includes(universidadFiltro)
        );
    }

    // Filtrar por nombre
    if (nombreFiltro) {
        estudiantesFiltrados = estudiantesFiltrados.filter(estudiante =>
            estudiante.nombre.toLowerCase().includes(nombreFiltro)
        );
    }

    if (estudiantesFiltrados.length === 0) {
        mostrarMensajeVacio('📭 No se encontraron estudiantes', 'Intenta con otros filtros.');
        return;
    }

    // Construir tabla
    let html = `
        <table class="tabla-resultados">
            <thead>
                <tr>
                    <th>Estudiante</th>
                    <th>Universidad</th>
                    <th>Materia</th>
                    <th>Intento</th>
                    <th>Nota</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                </tr>
            </thead>
            <tbody>
    `;

    estudiantesFiltrados.forEach(estudiante => {
        // Filtrar intentos por universidad y materia
        let intentosEstudiante = todosIntentos.filter(i => i.usuario === estudiante.usuario);

        if (universidadFiltro !== 'TODAS') {
            intentosEstudiante = intentosEstudiante.filter(i => i.universidad_codigo === universidadFiltro);
        }

        if (materiaFiltro !== 'TODAS') {
            intentosEstudiante = intentosEstudiante.filter(i => i.materia_nombre === materiaFiltro);
        }

        if (intentosEstudiante.length === 0) {
            // Mostrar estudiante sin intentos
            html += `
                <tr>
                    <td>${estudiante.nombre}</td>
                    <td><span class="badge badge-universidad">${estudiante.universidades_acceso.join(', ')}</span></td>
                    <td class="sin-intentos">-</td>
                    <td class="sin-intentos">-</td>
                    <td class="sin-intentos">-</td>
                    <td class="sin-intentos">Sin intentos</td>
                    <td class="sin-intentos">-</td>
                </tr>
            `;
        } else {
            // Mostrar cada intento
            intentosEstudiante.forEach((intento, index) => {
                const fecha = new Date(intento.tiempo_fin);
                const fechaFormato = fecha.toLocaleDateString('es-EC');
                const horaFormato = fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

                html += `
                    <tr>
                        <td>${index === 0 ? estudiante.nombre : ''}</td>
                        <td>${index === 0 ? `<span class="badge badge-universidad">${intento.universidad_codigo}</span>` : ''}</td>
                        <td><span class="badge badge-materia">${intento.materia_nombre}</span></td>
                        <td>#${index + 1}</td>
                        <td><span class="badge badge-nota">${intento.puntaje_obtenido}/1000</span></td>
                        <td>${fechaFormato}</td>
                        <td>${horaFormato}</td>
                    </tr>
                `;
            });
        }
    });

    html += `
            </tbody>
        </table>
    `;

    document.getElementById('resultadosContainer').innerHTML = html;
}

function mostrarMensajeVacio(titulo, descripcion) {
    const html = `
        <div class="mensaje-vacio">
            <div class="icono">📭</div>
            <h3>${titulo}</h3>
            <p>${descripcion}</p>
        </div>
    `;
    document.getElementById('resultadosContainer').innerHTML = html;
}

function cerrarSesion() {
    sessionStorage.removeItem('usuarioActual');
    window.location.href = 'login.html';
}
