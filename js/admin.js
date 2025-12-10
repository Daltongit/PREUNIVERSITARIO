// ==================== CONFIGURACIÓN ==================== 

const UNIVERSIDADES_MATERIAS = {
    'EPN': [],
    'UCE': [],
    'ESPE': [],
    'UNACH': [],
    'UPEC': [],
    'UTA': [],
    'UTC': [],
    'UTN': [],
    'YACHAY': []
};

let todosLosEstudiantes = [];
let todasLasMaterias = [];
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
    const usuarioActual = sessionStorage.getItem('usuarioActual');
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
            sessionStorage.removeItem('usuarioActual');
            window.location.href = 'login.html';
        }
    });
}

// ==================== CARGA DE DATOS ====================

async function cargarDatos() {
    try {
        mostrarCargando();

        // 1. Cargar usuarios desde JSON
        const responseUsuarios = await fetch('data/usuarios.json');
        const usuarios = await responseUsuarios.json();
        todosLosEstudiantes = usuarios.filter(u => u.rol === 'estudiante');
        
        console.log(`✅ ${todosLosEstudiantes.length} estudiantes cargados`);

        // 2. Cargar materias desde Supabase
        const { data: materias, error: errorMaterias } = await supabaseClient
            .from('materias')
            .select('*')
            .eq('activo', true)
            .order('nombre', { ascending: true });

        if (errorMaterias) {
            console.error('Error cargando materias:', errorMaterias);
            todasLasMaterias = [];
        } else {
            todasLasMaterias = materias || [];
            console.log(`✅ ${todasLasMaterias.length} materias cargadas desde Supabase`);
            
            // Limpiar el objeto de materias por universidad
            Object.keys(UNIVERSIDADES_MATERIAS).forEach(key => {
                UNIVERSIDADES_MATERIAS[key] = [];
            });
            
            // Organizar materias por universidad
            todasLasMaterias.forEach(materia => {
                const uniId = materia.universidad_id;
                if (uniId && UNIVERSIDADES_MATERIAS[uniId]) {
                    UNIVERSIDADES_MATERIAS[uniId].push({
                        id: materia.id,
                        nombre: materia.nombre,
                        codigo: materia.codigo
                    });
                }
            });
            
            // Debug: mostrar materias por universidad
            console.log('Materias por universidad:', UNIVERSIDADES_MATERIAS);
        }

        // 3. Cargar intentos desde Supabase
        const { data: intentos, error: errorIntentos } = await supabaseClient
            .from('intentos')
            .select(`
                *,
                materias (
                    nombre,
                    codigo,
                    universidad_id
                )
            `)
            .eq('completado', true)
            .order('fecha_inicio', { ascending: false });

        if (errorIntentos) {
            console.error('Error cargando intentos:', errorIntentos);
            todosLosIntentos = [];
        } else {
            todosLosIntentos = (intentos || []).map(intento => {
                const estudiante = todosLosEstudiantes.find(e => e.usuario === intento.usuario);
                
                return {
                    id: intento.id,
                    usuario: intento.usuario,
                    nombre: estudiante ? estudiante.nombre : intento.usuario,
                    universidad: intento.materias?.universidad_id || 'N/A',
                    materia: intento.materias?.nombre || 'N/A',
                    materia_id: intento.materia_id,
                    intento: 1,
                    nota: parseFloat(intento.puntaje_obtenido || 0),
                    notaMaxima: parseFloat(intento.total_preguntas || 10),
                    fecha: intento.fecha_inicio ? new Date(intento.fecha_inicio).toISOString().split('T')[0] : 'N/A',
                    hora: intento.fecha_inicio ? new Date(intento.fecha_inicio).toTimeString().split(' ')[0].substring(0, 5) : 'N/A',
                    duracion: intento.duracion_minutos || 0,
                    correctas: intento.preguntas_correctas || 0,
                    incorrectas: intento.preguntas_incorrectas || 0,
                    blanco: intento.preguntas_blanco || 0
                };
            });
            
            console.log(`✅ ${todosLosIntentos.length} intentos cargados`);
        }

        todosLosEstudiantes.forEach(est => {
            const intentos = todosLosIntentos.filter(i => i.usuario === est.usuario);
            intentosPorEstudiante.set(est.usuario, intentos);
        });

        actualizarMateriasDisponibles();
        aplicarFiltros();

    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        mostrarError('Error al cargar los datos. Por favor, recarga la página.');
    }
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
        const materiasUnicas = new Set();
        todasLasMaterias.forEach(m => {
            if (m.nombre) materiasUnicas.add(m.nombre);
        });
        
        Array.from(materiasUnicas).sort().forEach(nombre => {
            const option = document.createElement('option');
            option.value = nombre;
            option.textContent = nombre;
            selectMateria.appendChild(option);
        });
        
        console.log(`Materias en selector (TODAS): ${materiasUnicas.size}`);
    } else {
        const materiasUniversidad = UNIVERSIDADES_MATERIAS[universidadSeleccionada] || [];
        console.log(`Materias en ${universidadSeleccionada}:`, materiasUniversidad);
        
        materiasUniversidad.forEach(materia => {
            const option = document.createElement('option');
            option.value = materia.nombre;
            option.textContent = materia.nombre;
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

    if (universidadFiltro !== 'TODAS') {
        estudiantesFiltrados = estudiantesFiltrados.filter(est => 
            est.universidades_acceso.includes(universidadFiltro)
        );
    }

    if (nombreFiltro) {
        estudiantesFiltrados = estudiantesFiltrados.filter(est => 
            est.nombre.toLowerCase().includes(nombreFiltro)
        );
    }

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
                    <td><span class="sin-intentos">${dato.materia || 'N/A'}</span></td>
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
            const claseBadgeNota = obtenerClaseBadgeNota(dato.nota, dato.notaMaxima || 10);
            const notaMostrar = `${dato.nota.toFixed(1)}/${dato.notaMaxima || 10}`;
            
            html += `
                <tr>
                    <td>${dato.nombre}</td>
                    <td><span class="badge badge-universidad">${dato.universidad}</span></td>
                    <td><span class="badge badge-materia">${dato.materia}</span></td>
                    <td><span class="badge badge-intento">#${dato.intento}</span></td>
                    <td><span class="badge ${claseBadgeNota}">${notaMostrar}</span></td>
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

function obtenerClaseBadgeNota(nota, notaMaxima = 10) {
    const porcentaje = (nota / notaMaxima) * 100;
    if (porcentaje >= 70) return 'badge-nota-alta';
    if (porcentaje >= 40) return 'badge-nota-media';
    return 'badge-nota-baja';
}

function mostrarCargando() {
    document.getElementById('resultadosContainer').innerHTML = `
        <div class="mensaje-cargando">
            <div class="spinner"></div>
            <p>Cargando datos desde Supabase...</p>
        </div>
    `;
}

function mostrarError(mensaje) {
    document.getElementById('resultadosContainer').innerHTML = `
        <div class="mensaje-vacio">
            <div class="icono">❌</div>
            <h3>Error al cargar datos</h3>
            <p>${mensaje}</p>
        </div>
    `;
}

// ==================== GENERACIÓN DE PDFs CON GRÁFICOS ====================

function generarPDFGeneral() {
    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            alert('❌ Error: Biblioteca jsPDF no disponible');
            return;
        }

        const doc = new jsPDF();
        const universidadFiltro = document.getElementById('filtroUniversidad').value;
        const materiaFiltro = document.getElementById('filtroMateria').value;

        let estudiantesFiltrados = [...todosLosEstudiantes];
        if (universidadFiltro !== 'TODAS') {
            estudiantesFiltrados = estudiantesFiltrados.filter(est => 
                est.universidades_acceso.includes(universidadFiltro)
            );
        }
        estudiantesFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));

        const intentosFiltrados = todosLosIntentos.filter(int => {
            if (universidadFiltro !== 'TODAS' && int.universidad !== universidadFiltro) return false;
            if (materiaFiltro !== 'TODAS' && int.materia !== materiaFiltro) return false;
            return estudiantesFiltrados.some(e => e.usuario === int.usuario);
        });

        // ========== PÁGINA 1: PORTADA Y ESTADÍSTICAS ==========
        
        // Portada con diseño mejorado
        doc.setFillColor(201, 169, 97);
        doc.rect(0, 0, 210, 100, 'F');
        
        // Patrón decorativo
        doc.setDrawColor(184, 149, 79);
        doc.setLineWidth(0.5);
        for (let i = 0; i < 10; i++) {
            doc.line(0, i * 10, 210, i * 10);
        }
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(36);
        doc.setFont('helvetica', 'bold');
        doc.text('SPARTA ACADEMY', 105, 40, { align: 'center' });
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'normal');
        doc.text('Reporte General de Aspirantes', 105, 55, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(`${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 70, { align: 'center' });
        
        // Estadísticas principales
        let yPos = 115;
        
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(15, yPos, 180, 80, 3, 3, 'F');
        doc.setDrawColor(201, 169, 97);
        doc.setLineWidth(2);
        doc.roundedRect(15, yPos, 180, 80, 3, 3);
        
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('📊 ESTADÍSTICAS GENERALES', 105, yPos + 12, { align: 'center' });
        
        const totalEstudiantes = estudiantesFiltrados.length;
        const totalIntentos = intentosFiltrados.length;
        const promedioGeneral = totalIntentos > 0 
            ? (intentosFiltrados.reduce((sum, i) => sum + i.nota, 0) / totalIntentos).toFixed(2)
            : '0.00';
        const estudiantesConIntentos = new Set(intentosFiltrados.map(i => i.usuario)).size;
        
        // Tarjetas de estadísticas
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        
        doc.text('Total Estudiantes', 25, yPos + 30);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(201, 169, 97);
        doc.text(totalEstudiantes.toString(), 25, yPos + 42);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text('Total Intentos', 75, yPos + 30);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text(totalIntentos.toString(), 75, yPos + 42);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text('Promedio', 130, yPos + 30);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text(promedioGeneral, 130, yPos + 42);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text('Con Intentos', 25, yPos + 58);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(239, 68, 68);
        doc.text(estudiantesConIntentos.toString(), 25, yPos + 70);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text('Universidad', 75, yPos + 58);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text(universidadFiltro, 75, yPos + 70);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text('Materia', 130, yPos + 58);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 83, 9);
        doc.text(materiaFiltro.length > 15 ? materiaFiltro.substring(0, 12) + '...' : materiaFiltro, 130, yPos + 70);
        
        // ========== GRÁFICO DE BARRAS (simulado con rectángulos) ==========
        yPos = 210;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text('📈 Distribución de Notas', 20, yPos);
        
        // Calcular distribución
        const rangosNotas = { '0-3': 0, '4-6': 0, '7-10': 0 };
        intentosFiltrados.forEach(int => {
            const nota = int.nota;
            if (nota <= 3) rangosNotas['0-3']++;
            else if (nota <= 6) rangosNotas['4-6']++;
            else rangosNotas['7-10']++;
        });
        
        const maxAltura = 40;
        const maxValor = Math.max(...Object.values(rangosNotas), 1);
        
        yPos += 10;
        const barWidth = 40;
        const barSpacing = 20;
        let xPos = 30;
        
        Object.entries(rangosNotas).forEach(([rango, valor], index) => {
            const altura = (valor / maxValor) * maxAltura;
            const colors = [[239, 68, 68], [251, 191, 36], [16, 185, 129]];
            
            doc.setFillColor(...colors[index]);
            doc.rect(xPos, yPos + maxAltura - altura, barWidth, altura, 'F');
            
            doc.setDrawColor(201, 169, 97);
            doc.setLineWidth(1);
            doc.rect(xPos, yPos + maxAltura - altura, barWidth, altura);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(rango, xPos + barWidth / 2, yPos + maxAltura + 8, { align: 'center' });
            
            doc.setFontSize(12);
            doc.setTextColor(255, 255, 255);
            if (valor > 0) {
                doc.text(valor.toString(), xPos + barWidth / 2, yPos + maxAltura - altura / 2 + 2, { align: 'center' });
            }
            
            xPos += barWidth + barSpacing;
        });
        
        doc.addPage();
        
        // ========== DETALLES POR ESTUDIANTE ==========
        yPos = 20;
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('👥 Detalles por Estudiante', 20, yPos);
        yPos += 10;

        estudiantesFiltrados.forEach((estudiante, index) => {
            if (yPos > 260) {
                doc.addPage();
                yPos = 20;
            }

            // Encabezado del estudiante
            doc.setFillColor(201, 169, 97);
            doc.roundedRect(15, yPos, 180, 10, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}. ${estudiante.nombre}`, 20, yPos + 7);

            yPos += 14;

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
                doc.text(`🎓 ${uni}`, 20, yPos);
                yPos += 6;

                if (intentosEstudiante.length > 0) {
                    intentosEstudiante.forEach(intento => {
                        if (yPos > 280) {
                            doc.addPage();
                            yPos = 20;
                        }
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(55, 65, 81);
                        const porcentaje = ((intento.nota / (intento.notaMaxima || 10)) * 100).toFixed(0);
                        doc.text(`  • ${intento.materia} | Nota: ${intento.nota.toFixed(1)}/${intento.notaMaxima || 10} (${porcentaje}%) | ${intento.fecha}`, 25, yPos);
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

        // Footer en todas las páginas
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(`Página ${i} de ${pageCount} | Sparta Academy © ${new Date().getFullYear()}`, 105, 290, { align: 'center' });
        }

        doc.save(`Reporte-General-Sparta-${new Date().getTime()}.pdf`);
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        alert('❌ Error al generar el PDF. Revisa la consola.');
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

        // ========== PORTADA ==========
        doc.setFillColor(201, 169, 97);
        doc.rect(0, 0, 210, 80, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.text('SPARTA ACADEMY', 105, 30, { align: 'center' });
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text('Reporte Individual de Aspirante', 105, 45, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }), 105, 60, { align: 'center' });

        let yPos = 95;

        // Info del estudiante
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(15, yPos, 180, 30, 3, 3, 'F');
        doc.setDrawColor(201, 169, 97);
        doc.setLineWidth(2);
        doc.roundedRect(15, yPos, 180, 30, 3, 3);
        
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(estudiante.nombre, 105, yPos + 12, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text(`Usuario: ${estudiante.usuario}`, 105, yPos + 22, { align: 'center' });

        yPos += 40;

        // Estadísticas personales
        const intentosEstudiante = intentosPorEstudiante.get(estudiante.usuario) || [];
        const totalIntentosEst = intentosEstudiante.length;
        const promedioEst = totalIntentosEst > 0
            ? (intentosEstudiante.reduce((sum, i) => sum + i.nota, 0) / totalIntentosEst).toFixed(2)
            : '0.00';
        const mejorNota = totalIntentosEst > 0
            ? Math.max(...intentosEstudiante.map(i => i.nota)).toFixed(1)
            : '0.0';

        doc.setFillColor(249, 250, 251);
        doc.roundedRect(15, yPos, 180, 50, 3, 3, 'F');
        doc.setDrawColor(201, 169, 97);
        doc.setLineWidth(1);
        doc.roundedRect(15, yPos, 180, 50, 3, 3);
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text('📊 Estadísticas Personales', 105, yPos + 12, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        
        doc.text('Total Intentos:', 25, yPos + 28);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text(totalIntentosEst.toString(), 65, yPos + 28);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text('Promedio:', 95, yPos + 28);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text(promedioEst, 125, yPos + 28);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text('Mejor Nota:', 150, yPos + 28);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(201, 169, 97);
        doc.text(mejorNota, 180, yPos + 28);

        yPos += 60;

        // Detalles por universidad
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('🎓 Detalles por Universidad', 20, yPos);
        yPos += 10;

        estudiante.universidades_acceso.forEach(uni => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFillColor(201, 169, 97);
            doc.roundedRect(15, yPos, 180, 10, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(uni, 20, yPos + 7);

            yPos += 14;

            const intentosUni = intentosEstudiante.filter(int => int.universidad === uni);

            if (intentosUni.length > 0) {
                const intentosPorMateria = {};
                intentosUni.forEach(intento => {
                    if (!intentosPorMateria[intento.materia]) {
                        intentosPorMateria[intento.materia] = [];
                    }
                    intentosPorMateria[intento.materia].push(intento);
                });

                Object.keys(intentosPorMateria).forEach(materia => {
                    if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                    }

                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`📚 ${materia}`, 20, yPos);
                    yPos += 6;

                    intentosPorMateria[materia].forEach(intento => {
                        if (yPos > 280) {
                            doc.addPage();
                            yPos = 20;
                        }
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(55, 65, 81);
                        const porcentaje = ((intento.nota / (intento.notaMaxima || 10)) * 100).toFixed(0);
                        doc.text(`    • Intento #${intento.intento}: ${intento.nota.toFixed(1)}/${intento.notaMaxima || 10} (${porcentaje}%) | ${intento.fecha} ${intento.hora}`, 25, yPos);
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

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(`Página ${i} de ${pageCount} | Sparta Academy © ${new Date().getFullYear()}`, 105, 290, { align: 'center' });
        }

        doc.save(`Reporte-${estudiante.nombre.replace(/\s+/g, '-')}-${new Date().getTime()}.pdf`);

    } catch (error) {
        console.error('Error generando PDF individual:', error);
        alert('❌ Error al generar el PDF. Revisa la consola.');
    }
}
