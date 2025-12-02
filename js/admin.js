document.addEventListener('DOMContentLoaded', async function() {
    const usuarioActual = JSON.parse(sessionStorage.getItem('usuarioActual'));
    
    if (!usuarioActual || usuarioActual.rol !== 'admin') {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('userName').textContent = usuarioActual.nombre;

    let todosLosIntentos = [];
    let todosLosUsuarios = [];

    await cargarDatos();

    document.getElementById('filterCiudad').addEventListener('change', filtrarResultados);
    document.getElementById('filterUniversidad').addEventListener('change', filtrarResultados);
    document.getElementById('searchNombre').addEventListener('input', filtrarResultados);
    document.getElementById('btnPDFGeneral').addEventListener('click', generarPDFGeneral);
    document.getElementById('btnVolver').addEventListener('click', () => window.location.href = 'index.html');
    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);

    async function cargarDatos() {
        try {
            // Cargar usuarios desde la raíz
            const response = await fetch('data/usuarios.json');
            const usuarios = await response.json();
            
            // Filtrar solo estudiantes
            todosLosUsuarios = usuarios.filter(u => u.rol === 'estudiante');

            // Cargar intentos desde Supabase
            const { data: intentos, error: errorIntentos } = await supabaseClient
                .from('intentos')
                .select('*')
                .order('created_at', { ascending: false });

            if (errorIntentos) {
                console.error('Error al cargar intentos:', errorIntentos);
                todosLosIntentos = [];
            } else {
                // Filtrar intentos solo de estudiantes
                const usuariosEstudiantes = todosLosUsuarios.map(u => u.usuario);
                todosLosIntentos = (intentos || []).filter(i => usuariosEstudiantes.includes(i.usuario));
            }

            filtrarResultados();

        } catch (err) {
            console.error('Error:', err);
        }
    }

    function filtrarResultados() {
        const ciudad = document.getElementById('filterCiudad').value;
        const universidad = document.getElementById('filterUniversidad').value;
        const busqueda = document.getElementById('searchNombre').value.toLowerCase();

        // Filtrar intentos según criterios
        let intentosFiltrados = todosLosIntentos.filter(intento => {
            const cumpleCiudad = ciudad === 'TODAS' || intento.ciudad === ciudad;
            const cumpleUniversidad = universidad === 'TODAS' || intento.universidad_codigo === universidad;
            const cumpleBusqueda = intento.nombre_completo.toLowerCase().includes(busqueda);
            
            return cumpleCiudad && cumpleUniversidad && cumpleBusqueda;
        });

        // Agrupar intentos por usuario
        const intentosPorUsuario = {};
        intentosFiltrados.forEach(intento => {
            if (!intentosPorUsuario[intento.usuario]) {
                intentosPorUsuario[intento.usuario] = [];
            }
            intentosPorUsuario[intento.usuario].push(intento);
        });

        renderResultados(intentosPorUsuario);
    }

    function renderResultados(intentosPorUsuario) {
        const container = document.getElementById('resultadosContainer');
        
        const usuarios = Object.keys(intentosPorUsuario);
        
        if (usuarios.length === 0) {
            container.innerHTML = `
                <div class="no-resultados">
                    <div class="no-resultados-icon">📭</div>
                    <p>No se encontraron resultados con los filtros seleccionados</p>
                </div>
            `;
            return;
        }

        // Ordenar usuarios alfabéticamente por nombre
        usuarios.sort((a, b) => {
            const nombreA = intentosPorUsuario[a][0].nombre_completo;
            const nombreB = intentosPorUsuario[b][0].nombre_completo;
            return nombreA.localeCompare(nombreB);
        });

        container.innerHTML = '';

        usuarios.forEach(usuario => {
            const intentosUsuario = intentosPorUsuario[usuario];
            const primerIntento = intentosUsuario[0];
            
            const card = document.createElement('div');
            card.className = 'aspirante-card';
            
            const iniciales = primerIntento.nombre_completo.split(' ').map(n => n[0]).join('').substring(0, 2);
            
            card.innerHTML = `
                <div class="aspirante-header" data-usuario="${usuario}">
                    <div class="aspirante-info">
                        <div class="aspirante-avatar">${iniciales}</div>
                        <div>
                            <div class="aspirante-nombre">${primerIntento.nombre_completo}</div>
                            <div class="aspirante-intentos">${intentosUsuario.length} intento(s) - ${primerIntento.ciudad}</div>
                        </div>
                    </div>
                    <div class="aspirante-actions">
                        <button class="btn-toggle" onclick="toggleDetalles('${usuario}')">▼ Ver Detalles</button>
                        <button class="btn-pdf-individual" onclick="generarPDFIndividual('${usuario}')">📄 PDF</button>
                    </div>
                </div>
                <div class="aspirante-detalles" id="detalles-${usuario}">
                    ${renderTablaIntentos(intentosUsuario)}
                </div>
            `;
            
            container.appendChild(card);
        });
    }

    function renderTablaIntentos(intentos) {
        if (intentos.length === 0) return '<p>No hay intentos registrados</p>';

        let html = `
            <table class="intentos-table">
                <thead>
                    <tr>
                        <th>Universidad</th>
                        <th>Materia</th>
                        <th>Puntaje</th>
                        <th>Correctas</th>
                        <th>Incorrectas</th>
                        <th>En Blanco</th>
                        <th>Fecha Inicio</th>
                        <th>Fecha Fin</th>
                    </tr>
                </thead>
                <tbody>
        `;

        intentos.forEach(intento => {
            const puntaje = intento.puntaje_obtenido;
            const porcentaje = Math.round((puntaje / 1000) * 100);
            
            let clasePuntaje = 'puntaje-bajo';
            if (porcentaje >= 80) clasePuntaje = 'puntaje-excelente';
            else if (porcentaje >= 60) clasePuntaje = 'puntaje-bueno';
            else if (porcentaje >= 40) clasePuntaje = 'puntaje-regular';

            const fechaInicio = new Date(intento.tiempo_inicio).toLocaleString('es-EC', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            const fechaFin = new Date(intento.tiempo_fin).toLocaleString('es-EC', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            html += `
                <tr>
                    <td>${intento.universidad_codigo}</td>
                    <td>${intento.materia_nombre}</td>
                    <td><span class="puntaje-badge ${clasePuntaje}">${puntaje}/1000</span></td>
                    <td>${intento.correctas}</td>
                    <td>${intento.incorrectas}</td>
                    <td>${intento.en_blanco}</td>
                    <td>${fechaInicio}</td>
                    <td>${fechaFin}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        return html;
    }

    window.toggleDetalles = function(usuario) {
        const detalles = document.getElementById(`detalles-${usuario}`);
        detalles.classList.toggle('active');
        
        const btn = document.querySelector(`[data-usuario="${usuario}"] .btn-toggle`);
        if (detalles.classList.contains('active')) {
            btn.textContent = '▲ Ocultar Detalles';
        } else {
            btn.textContent = '▼ Ver Detalles';
        }
    };

    window.generarPDFIndividual = async function(usuario) {
        const intentosUsuario = todosLosIntentos.filter(i => i.usuario === usuario);
        const primerIntento = intentosUsuario[0];

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('SPARTA ACADEMY', 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Reporte Individual de Aspirante', 105, 28, { align: 'center' });

        doc.setFontSize(11);
        doc.text(`Aspirante: ${primerIntento.nombre_completo}`, 20, 45);
        doc.text(`Ciudad: ${primerIntento.ciudad}`, 20, 52);
        doc.text(`Total de Intentos: ${intentosUsuario.length}`, 20, 59);

        const tableData = intentosUsuario.map(i => [
            i.universidad_codigo,
            i.materia_nombre,
            `${i.puntaje_obtenido}/1000`,
            i.correctas,
            i.incorrectas,
            i.en_blanco,
            new Date(i.tiempo_inicio).toLocaleString('es-EC'),
            new Date(i.tiempo_fin).toLocaleString('es-EC')
        ]);

        doc.autoTable({
            startY: 70,
            head: [['Universidad', 'Materia', 'Puntaje', 'Correctas', 'Incorrectas', 'En Blanco', 'Inicio', 'Fin']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [201, 169, 97] },
            styles: { fontSize: 9 }
        });

        doc.save(`${primerIntento.nombre_completo.replace(/\s+/g, '_')}_reporte.pdf`);
    };

    function generarPDFGeneral() {
        const ciudad = document.getElementById('filterCiudad').value;
        const universidad = document.getElementById('filterUniversidad').value;

        let intentosFiltrados = todosLosIntentos.filter(intento => {
            const cumpleCiudad = ciudad === 'TODAS' || intento.ciudad === ciudad;
            const cumpleUniversidad = universidad === 'TODAS' || intento.universidad_codigo === universidad;
            return cumpleCiudad && cumpleUniversidad;
        });

        // Ordenar por nombre
        intentosFiltrados.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');

        doc.setFontSize(18);
        doc.text('SPARTA ACADEMY', 148, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Reporte General de Resultados', 148, 22, { align: 'center' });

        doc.setFontSize(10);
        doc.text(`Ciudad: ${ciudad}`, 20, 32);
        doc.text(`Universidad: ${universidad}`, 20, 38);
        doc.text(`Total de intentos: ${intentosFiltrados.length}`, 20, 44);

        const tableData = intentosFiltrados.map(intento => [
            intento.nombre_completo,
            intento.ciudad,
            intento.universidad_codigo,
            intento.materia_nombre,
            `${intento.puntaje_obtenido}/1000`,
            intento.correctas,
            intento.incorrectas,
            intento.en_blanco,
            new Date(intento.tiempo_inicio).toLocaleString('es-EC')
        ]);

        doc.autoTable({
            startY: 50,
            head: [['Nombre', 'Ciudad', 'Universidad', 'Materia', 'Puntaje', 'Correctas', 'Incorrectas', 'Blanco', 'Fecha']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [201, 169, 97] },
            styles: { fontSize: 8 }
        });

        doc.save(`reporte_general_${Date.now()}.pdf`);
    }

    function cerrarSesion() {
        sessionStorage.removeItem('usuarioActual');
        window.location.href = 'login.html';
    }

    history.pushState(null, null, location.href);
    window.onpopstate = function () {
        history.go(1);
    };
});
