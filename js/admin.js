// ==================== CONFIGURACIÓN ====================

const UNIVERSIDADES_MATERIAS = {
    'EPN': ['general1', 'general2', 'matematicas'],
    'UCE': ['general1', 'general2', 'matematicas'],
    'ESPE': ['general1', 'general2', 'matematicas'],
    'UNACH': ['general1', 'general2', 'matematicas'],
    'UPEC': ['general1', 'general2', 'matematicas'],
    'UTA': ['general1', 'general2', 'matematicas'],
    'UTC': ['general1', 'general2', 'matematicas'],
    'UTN': ['general1', 'general2', 'matematicas'],
    'YACHAY': ['general1', 'general2', 'matematicas']
};

const NOMBRE_MATERIAS = {
    'general1': 'General 1',
    'general2': 'General 2',
    'matematicas': 'Matemáticas'
};

let todosLosEstudiantes = [];
let todosLosIntentos = [];
let intentosPorEstudiante = new Map();

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', async () => {
    verificarAutenticacion();
    configurarHeader();
    await cargarDatos();
    configurarEventos();
});

// ==================== AUTENTICACIÓN ====================

function verificarAutenticacion() {
    const usuarioActual = localStorage.getItem('usuarioActual');
    if (!usuarioActual) {
        window.location.href = 'login.html';
        return;
    }

    const usuario = JSON.parse(usuarioActual);
    if (usuario.rol !== 'admin') {
        alert('❌ Acceso denegado. Solo administradores pueden ver esta página.');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('userName').textContent = usuario.nombre;
}

function configurarHeader() {
    document.getElementById('btnVolver').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    document.getElementById('btnLogout').addEventListener('click', () => {
        if (confirm('¿Estás seguro de cerrar sesión?')) {
            localStorage.removeItem('usuarioActual');
            window.location.href = 'login.html';
        }
    });
}

// ==================== CARGA DE DATOS ====================

async function cargarDatos() {
    try {
        mostrarCargando();

        // Cargar usuarios desde el JSON
        const responseUsuarios = await fetch('data/usuarios.json');
        const usuarios = await responseUsuarios.json();

        // Filtrar solo estudiantes (excluir admins)
        todosLosEstudiantes = usuarios.filter(u => u.rol === 'estudiante');

        console.log(`✅ ${todosLosEstudiantes.length} estudiantes cargados`);

        // Cargar intentos de todas las universidades y materias
        await cargarIntentosDesdeArchivos();

        // Mostrar resultados iniciales
        actualizarMateriasDisponibles();
        aplicarFiltros();

    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        mostrarError(error.message);
    }
}

async function cargarIntentosDesdeArchivos() {
    const intentosCargados = [];
    
    for (const estudiante of todosLosEstudiantes) {
        for (const universidad of estudiante.universidades_acceso) {
            const materias = UNIVERSIDADES_MATERIAS[universidad] || [];
            
            for (const materia of materias) {
                const rutaArchivo = `universidades/${universidad}/data/${materia}.json`;
                
                try {
                    const response = await fetch(rutaArchivo);
                    if (!response.ok) continue;
                    
                    const datos = await response.json();
                    
                    // Buscar intentos del estudiante en este archivo
                    if (datos.intentos && Array.isArray(datos.intentos)) {
                        const intentosEstudiante = datos.intentos.filter(i => 
                            i.usuario === estudiante.usuario || i.nombre === estudiante.nombre
                        );
                        
                        intentosEstudiante.forEach(intento => {
                            intentosCargados.push({
                                usuario: estudiante.usuario,
                                nombre: estudiante.nombre,
                                universidad: universidad,
                                materia: NOMBRE_MATERIAS[materia] || materia,
                                intento: intento.numeroIntento || 1,
                                nota: intento.calificacion || intento.nota || 0,
                                fecha: intento.fecha || new Date().toISOString().split('T')[0],
                                hora: intento.hora || '00:00'
                            });
                        });
                    }
                } catch (error) {
                    console.warn(`⚠️ No se pudo cargar ${rutaArchivo}`);
                }
            }
        }
    }

    todosLosIntentos = intentosCargados;
    console.log(`✅ ${todosLosIntentos.length} intentos cargados`);
    
    // Organizar intentos por estudiante
    todosLosEstudiantes.forEach(est => {
        const intentos = todosLosIntentos.filter(i => i.usuario === est.usuario);
        intentosPorEstudiante.set(est.usuario, intentos);
    });
}

// ==================== EVENTOS ====================

function configurarEventos() {
    document.getElementById('filtroUniversidad').addEventListener('change', () => {
        actualizarMateriasDisponibles();
        aplicarFiltros();
    });

    document.getElementById('filtroMateria').addEventListener('change', aplicarFiltros);
    
    document.getElementById('buscarNombre').addEventListener('input', aplicarFiltros);
    
    document.getElementById('btnPdfGeneral').addEventListener('click', generarPDFGeneral);
}

function actualizarMateriasDisponibles() {
    const universidadSeleccionada = document.getElementById('filtroUniversidad').value;
    const selectMateria = document.getElementById('filtroMateria');
    
    selectMateria.innerHTML = '<option value="TODAS">Todas las Materias</option>';
    
    if (universidadSeleccionada === 'TODAS') {
        // Todas las materias disponibles
        const todasMaterias = new Set();
        Object.values(NOMBRE_MATERIAS).forEach(m => todasMaterias.add(m));
        
        todasMaterias.forEach(materia => {
            const option = document.createElement('option');
            option.value = materia;
            option.textContent = materia;
            selectMateria.appendChild(option);
        });
    } else {
        // Materias específicas de la universidad
        const materiasKeys = UNIVERSIDADES_MATERIAS[universidadSeleccionada] || [];
        materiasKeys.forEach(key => {
            const nombreMateria = NOMBRE_MATERIAS[key] || key;
            const option = document.createElement('option');
            option.value = nombreMateria;
            option.textContent = nombreMateria;
            selectMateria.appendChild(option);
        });
    }
}

// ==================== FILTROS ====================

function aplicarFiltros() {
    const universidadFiltro = document.getElementById('filtroUniversidad').value;
    const materiaFiltro = document.getElementById('filtroMateria').value;
    const nombreFiltro = document.getElementById('buscarNombre').value.toLowerCase().trim();

    let estudiantesFiltrados = [...todosLosEstudiantes];

    // Filtrar por universidad
    if (universidadFiltro !== 'TODAS') {
        estudiantesFiltrados = estudiantesFiltrados.filter(est => 
            est.universidades_acceso.includes(universidadFiltro)
        );
    }

    // Filtrar por nombre
    if (nombreFiltro) {
        estudiantesFiltrados = estudiantesFiltrados.filter(est => 
            est.nombre.toLowerCase().includes(nombreFiltro)
        );
    }

    // Construir datos para la tabla
    const datosTabla = [];

    estudiantesFiltrados.forEach(estudiante => {
        const universidadesParaMostrar = universidadFiltro === 'TODAS' 
            ? estudiante.universidades_acceso 
            : [universidadFiltro];

        universidadesParaMostrar.forEach(uni => {
            const intentosEstudiante = todosLosIntentos.filter(int => 
                int.usuario === estudiante.usuario && int.universidad === uni
            );

            if (materiaFiltro === 'TODAS') {
                if (intentosEstudiante.length > 0) {
                    intentosEstudiante.forEach(intento => {
                        datosTabla.push({
                            ...intento,
                            nombre: estudiante.nombre
                        });
                    });
                } else {
                    // Mostrar estudiante sin intentos
                    datosTabla.push({
                        usuario: estudiante.usuario,
                        nombre: estudiante.nombre,
                        universidad: uni,
                        sinIntentos: true
                    });
                }
            } else {
                const intentosMateria = intentosEstudiante.filter(int => 
                    int.materia === materiaFiltro
                );

                if (intentosMateria.length > 0) {
                    intentosMateria.forEach(intento => {
                        datosTabla.push({
                            ...intento,
                            nombre: estudiante.nombre
                        });
                    });
                } else {
                    // Mostrar estudiante sin intentos en esa materia
                    datosTabla.push({
                        usuario: estudiante.usuario,
                        nombre: estudiante.nombre,
                        universidad: uni,
                        materia: materiaFiltro,
                        sinIntentos: true
                    });
                }
            }
        });
    });

    // Ordenar por nombre del estudiante
    datosTabla.sort((a, b) => a.nombre.localeCompare(b.nombre));

    mostrarTabla(datosTabla);
}

// ==================== VISUALIZACIÓN ====================

function mostrarTabla(datos) {
    const container = document.getElementById('resultadosContainer');

    if (datos.length === 0) {
        container.innerHTML = `
            <div class="mensaje-vacio">
                <div class="icono">📭</div>
                <h3>No se encontraron resultados</h3>
                <p>Intenta ajustar los filtros de búsqueda</p>
            </div>
        `;
        return;
    }

    let html = `
        <table class="tabla-resultados">
            <thead>
                <tr>
                    <th>ESTUDIANTE</th>
                    <th>UNIVERSIDAD</th>
                    <th>MATERIA</th>
                    <th>INTENTO</th>
                    <th>NOTA</th>
                    <th>FECHA</th>
                    <th>HORA</th>
                    <th>ACCIÓN</th>
                </tr>
            </thead>
            <tbody>
    `;

    datos.forEach(dato => {
        if (dato.sinIntentos) {
            html += `
                <tr>
                    <td>${dato.nombre}</td>
                    <td><span class="badge badge-universidad">${dato.universidad}</span></td>
                    <td><span class="sin-intentos">${dato.materia || 'Sin materias'}</span></td>
                    <td><span class="sin-intentos">-</span></td>
                    <td><span class="sin-intentos">-</span></td>
                    <td><span class="sin-intentos">Sin intentos</span></td>
                    <td><span class="sin-intentos">-</span></td>
                    <td>
                        <button class="btn-pdf-individual" onclick="generarPDFIndividual('${dato.usuario}')">
                            📄 PDF
                        </button>
                    </td>
                </tr>
            `;
        } else {
            const claseBadgeNota = obtenerClaseBadgeNota(dato.nota);
            html += `
                <tr>
                    <td>${dato.nombre}</td>
                    <td><span class="badge badge-universidad">${dato.universidad}</span></td>
                    <td><span class="badge badge-materia">${dato.materia}</span></td>
                    <td><span class="badge badge-intento">#${dato.intento}</span></td>
                    <td><span class="badge ${claseBadgeNota}">${parseFloat(dato.nota).toFixed(2)}</span></td>
                    <td>${dato.fecha}</td>
                    <td>${dato.hora}</td>
                    <td>
                        <button class="btn-pdf-individual" onclick="generarPDFIndividual('${dato.usuario}')">
                            📄 PDF
                        </button>
                    </td>
                </tr>
            `;
        }
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

function obtenerClaseBadgeNota(nota) {
    const notaNum = parseFloat(nota);
    if (notaNum >= 7) return 'badge-nota-alta';
    if (notaNum >= 4) return 'badge-nota-media';
    return 'badge-nota-baja';
}

function mostrarCargando() {
    document.getElementById('resultadosContainer').innerHTML = `
        <div class="mensaje-cargando">
            <div class="spinner"></div>
            <p>Cargando datos...</p>
        </div>
    `;
}

function mostrarError(mensaje) {
    document.getElementById('resultadosContainer').innerHTML = `
        <div class="mensaje-vacio">
            <div class="icono">❌</div>
            <h3>Error al cargar datos</h3>
            <p>${mensaje || 'Intenta recargar la página'}</p>
        </div>
    `;
}

// ==================== GENERACIÓN DE PDFs ====================

function generarPDFGeneral() {
    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            alert('❌ Error: No se pudo cargar la biblioteca jsPDF');
            return;
        }

        const doc = new jsPDF();

        const universidadFiltro = document.getElementById('filtroUniversidad').value;
        const materiaFiltro = document.getElementById('filtroMateria').value;

        // Obtener datos filtrados
        let estudiantesFiltrados = [...todosLosEstudiantes];

        if (universidadFiltro !== 'TODAS') {
            estudiantesFiltrados = estudiantesFiltrados.filter(est => 
                est.universidades_acceso.includes(universidadFiltro)
            );
        }

        estudiantesFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));

        let yPos = 20;

        // ========== HEADER ==========
        doc.setFillColor(201, 169, 97);
        doc.rect(0, 0, 210, 45, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(26);
        doc.setFont('helvetica', 'bold');
        doc.text('SPARTA ACADEMY', 105, 20, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text('Reporte General de Intentos de Aspirantes', 105, 32, { align: 'center' });

        yPos = 55;

        // ========== INFO DEL REPORTE ==========
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, yPos);
        yPos += 6;
        doc.text(`Universidad: ${universidadFiltro}`, 20, yPos);
        yPos += 6;
        doc.text(`Materia: ${materiaFiltro}`, 20, yPos);
        yPos += 12;

        // ========== ESTADÍSTICAS ==========
        const totalEstudiantes = estudiantesFiltrados.length;
        const intentosFiltrados = todosLosIntentos.filter(int => {
            if (universidadFiltro !== 'TODAS' && int.universidad !== universidadFiltro) return false;
            if (materiaFiltro !== 'TODAS' && int.materia !== materiaFiltro) return false;
            return estudiantesFiltrados.some(e => e.usuario === int.usuario);
        });
        const totalIntentos = intentosFiltrados.length;
        const promedioGeneral = totalIntentos > 0 
            ? (intentosFiltrados.reduce((sum, i) => sum + parseFloat(i.nota), 0) / totalIntentos).toFixed(2)
            : '0.00';

        doc.setFillColor(249, 250, 251);
        doc.rect(15, yPos, 180, 30, 'F');
        
        doc.setDrawColor(201, 169, 97);
        doc.setLineWidth(1);
        doc.rect(15, yPos, 180, 30);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text('Estadísticas Generales', 20, yPos + 8);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text(`Total de estudiantes: ${totalEstudiantes}`, 20, yPos + 16);
        doc.text(`Total de intentos: ${totalIntentos}`, 20, yPos + 23);
        doc.text(`Promedio general: ${promedioGeneral}`, 105, yPos + 16);

        yPos += 40;

        // ========== DATOS POR ESTUDIANTE ==========
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Detalles por Estudiante', 20, yPos);
        yPos += 8;

        estudiantesFiltrados.forEach((estudiante, index) => {
            if (yPos > 260) {
                doc.addPage();
                yPos = 20;
            }

            // Nombre del estudiante
            doc.setFillColor(201, 169, 97);
            doc.rect(15, yPos, 180, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}. ${estudiante.nombre}`, 20, yPos + 6);

            yPos += 12;

            // Universidades y intentos
            const universidadesParaMostrar = universidadFiltro === 'TODAS' 
                ? estudiante.universidades_acceso 
                : [universidadFiltro];

            universidadesParaMostrar.forEach(uni => {
                const intentosEstudiante = todosLosIntentos.filter(int => 
                    int.usuario === estudiante.usuario && 
                    int.universidad === uni &&
                    (materiaFiltro === 'TODAS' || int.materia === materiaFiltro)
                );

                doc.setTextColor(0, 0, 0);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`Universidad: ${uni}`, 20, yPos);
                yPos += 6;

                if (intentosEstudiante.length > 0) {
                    intentosEstudiante.forEach(intento => {
                        if (yPos > 280) {
                            doc.addPage();
                            yPos = 20;
                        }
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(55, 65, 81);
                        doc.text(`  • ${intento.materia} | Intento #${intento.intento} | Nota: ${parseFloat(intento.nota).toFixed(2)} | ${intento.fecha} ${intento.hora}`, 25, yPos);
                        yPos += 5;
                    });
                } else {
                    doc.setFont('helvetica', 'italic');
                    doc.setTextColor(156, 163, 175);
                    doc.text('  Sin intentos registrados', 25, yPos);
                    yPos += 5;
                }

                yPos += 3;
            });

            yPos += 5;
        });

        // ========== FOOTER ==========
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.setFont('helvetica', 'normal');
            doc.text(`Página ${i} de ${pageCount} | Generado por Sparta Academy`, 105, 290, { align: 'center' });
        }

        doc.save(`Reporte-General-Sparta-${new Date().getTime()}.pdf`);
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        alert('❌ Error al generar el PDF. Verifica la consola.');
    }
}

function generarPDFIndividual(usuarioId) {
    try {
        const estudiante = todosLosEstudiantes.find(e => e.usuario === usuarioId);
        if (!estudiante) {
            alert('❌ No se encontró el estudiante');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // ========== HEADER ==========
        doc.setFillColor(201, 169, 97);
        doc.rect(0, 0, 210, 45, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(26);
        doc.setFont('helvetica', 'bold');
        doc.text('SPARTA ACADEMY', 105, 20, { align: 'center' });
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text('Reporte Individual de Aspirante', 105, 32, { align: 'center' });

        let yPos = 60;

        // ========== INFO DEL ESTUDIANTE ==========
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(estudiante.nombre, 20, yPos);
        
        yPos += 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text(`Usuario: ${estudiante.usuario}`, 20, yPos);
        
        yPos += 6;
        doc.text(`Fecha de reporte: ${new Date().toLocaleDateString('es-ES')}`, 20, yPos);
        
        yPos += 15;

        // ========== ESTADÍSTICAS PERSONALES ==========
        const intentosEstudiante = intentosPorEstudiante.get(estudiante.usuario) || [];
        const totalIntentosEst = intentosEstudiante.length;
        const promedioEst = totalIntentosEst > 0
            ? (intentosEstudiante.reduce((sum, i) => sum + parseFloat(i.nota), 0) / totalIntentosEst).toFixed(2)
            : '0.00';

        doc.setFillColor(249, 250, 251);
        doc.rect(15, yPos, 180, 25, 'F');
        doc.setDrawColor(201, 169, 97);
        doc.setLineWidth(1);
        doc.rect(15, yPos, 180, 25);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text('Estadísticas del Estudiante', 20, yPos + 8);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text(`Total de intentos: ${totalIntentosEst}`, 20, yPos + 18);
        doc.text(`Promedio: ${promedioEst}`, 105, yPos + 18);

        yPos += 35;

        // ========== DETALLES POR UNIVERSIDAD ==========
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Detalles por Universidad', 20, yPos);
        yPos += 10;

        estudiante.universidades_acceso.forEach(uni => {
            if (yPos > 260) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFillColor(201, 169, 97);
            doc.rect(15, yPos, 180, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(uni, 20, yPos + 6);

            yPos += 12;

            const intentosUni = intentosEstudiante.filter(int => int.universidad === uni);

            if (intentosUni.length > 0) {
                // Agrupar por materia
                const intentosPorMateria = {};
                intentosUni.forEach(intento => {
                    if (!intentosPorMateria[intento.materia]) {
                        intentosPorMateria[intento.materia] = [];
                    }
                    intentosPorMateria[intento.materia].push(intento);
                });

                Object.keys(intentosPorMateria).forEach(materia => {
                    if (yPos > 275) {
                        doc.addPage();
                        yPos = 20;
                    }

                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`• ${materia}`, 20, yPos);
                    yPos += 6;

                    intentosPorMateria[materia].forEach(intento => {
                        if (yPos > 280) {
                            doc.addPage();
                            yPos = 20;
                        }
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(55, 65, 81);
                        doc.text(`    Intento #${intento.intento}: ${parseFloat(intento.nota).toFixed(2)} pts | ${intento.fecha} ${intento.hora}`, 25, yPos);
                        yPos += 5;
                    });

                    yPos += 3;
                });
            } else {
                doc.setTextColor(156, 163, 175);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(10);
                doc.text('Sin intentos registrados en esta universidad', 20, yPos);
                yPos += 6;
            }

            yPos += 8;
        });

        // ========== FOOTER ==========
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.setFont('helvetica', 'normal');
            doc.text(`Página ${i} de ${pageCount} | Generado por Sparta Academy`, 105, 290, { align: 'center' });
        }

        doc.save(`Reporte-${estudiante.nombre.replace(/\s+/g, '-')}-${new Date().getTime()}.pdf`);

    } catch (error) {
        console.error('Error generando PDF individual:', error);
        alert('❌ Error al generar el PDF. Verifica la consola.');
    }
}
