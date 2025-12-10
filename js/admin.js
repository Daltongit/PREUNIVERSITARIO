// ==================== CONFIGURACIÓN ==================== 

const UNIVERSIDADES = ['EPN', 'UCE', 'ESPE', 'UNACH', 'UPEC', 'UTA', 'UTC', 'UTN', 'YACHAY'];

let todosLosEstudiantes = [];
let todasLasMaterias = [];
let todosLosIntentos = [];
let intentosPorEstudiante = new Map();

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', async () => {
    verificarAutenticacion();
    configurarHeader();
    
    // Esperar a que auto-materias.js termine
    setTimeout(async () => {
        await cargarDatos();
        configurarEventos();
    }, 1000);
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

        if (!errorMaterias && materias) {
            todasLasMaterias = materias;
            console.log(`✅ ${todasLasMaterias.length} materias cargadas desde Supabase`);
            
            // Organizar por universidad
            window.UNIVERSIDADES_MATERIAS = {};
            UNIVERSIDADES.forEach(uni => {
                window.UNIVERSIDADES_MATERIAS[uni] = materias
                    .filter(m => m.universidad_id === uni)
                    .map(m => m.nombre)
                    .sort();
            });
            
            console.log('📚 Materias por universidad:', window.UNIVERSIDADES_MATERIAS);
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

        if (!errorIntentos && intentos) {
            todosLosIntentos = intentos.map(intento => {
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
    
    if (!window.UNIVERSIDADES_MATERIAS) return;
    
    if (universidadSeleccionada === 'TODAS') {
        const todasLasMaterias = new Set();
        Object.values(window.UNIVERSIDADES_MATERIAS).forEach(materias => {
            materias.forEach(m => todasLasMaterias.add(m));
        });
        
        Array.from(todasLasMaterias).sort().forEach(nombre => {
            const option = document.createElement('option');
            option.value = nombre;
            option.textContent = nombre;
            selectMateria.appendChild(option);
        });
    } else {
        const materiasUniversidad = window.UNIVERSIDADES_MATERIAS[universidadSeleccionada] || [];
        materiasUniversidad.forEach(nombre => {
            const option = document.createElement('option');
            option.value = nombre;
            option.textContent = nombre;
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
            <p>Cargando datos...</p>
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

// ==================== GENERACIÓN DE PDFs ====================

async function crearGraficoBarras(datos, etiquetas, colores) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const maxValor = Math.max(...datos, 1);
    const barWidth = canvas.width / (datos.length * 2);
    const maxHeight = canvas.height - 60;
    
    datos.forEach((valor, index) => {
        const altura = (valor / maxValor) * maxHeight;
        const x = (index * 2 + 0.5) * barWidth;
        const y = canvas.height - altura - 40;
        
        const gradient = ctx.createLinearGradient(x, y, x, y + altura);
        gradient.addColorStop(0, colores[index][0]);
        gradient.addColorStop(1, colores[index][1]);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, altura);
        
        ctx.strokeStyle = '#C9A961';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, altura);
        
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(valor.toString(), x + barWidth / 2, y - 5);
        
        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        ctx.fillText(etiquetas[index], x + barWidth / 2, canvas.height - 20);
    });
    
    return canvas.toDataURL('image/png');
}

async function generarPDFGeneral() {
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

        // PORTADA
        for (let i = 0; i < 100; i++) {
            doc.setFillColor(201 - i, 169 - i, 97 - i);
            doc.rect(0, i, 210, 1, 'F');
        }
        
        doc.setFillColor(201, 169, 97);
        doc.circle(105, 40, 15, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('S', 105, 45, { align: 'center' });
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(38);
        doc.setFont('helvetica', 'bold');
        doc.text('SPARTA ACADEMY', 105, 70, { align: 'center' });
        
        doc.setFontSize(20);
        doc.setFont('helvetica', 'normal');
        doc.text('Reporte General de Aspirantes', 105, 85, { align: 'center' });
        
        doc.setFontSize(14);
        const fechaHoy = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        doc.text(fechaHoy, 105, 95, { align: 'center' });
        
        // ESTADÍSTICAS
        let yPos = 115;
        
        const totalEstudiantes = estudiantesFiltrados.length;
        const totalIntentos = intentosFiltrados.length;
        const promedioGeneral = totalIntentos > 0 
            ? (intentosFiltrados.reduce((sum, i) => sum + i.nota, 0) / totalIntentos).toFixed(2)
            : '0.00';
        const estudiantesConIntentos = new Set(intentosFiltrados.map(i => i.usuario)).size;
        
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(15, yPos, 180, 70, 5, 5, 'F');
        doc.setDrawColor(201, 169, 97);
        doc.setLineWidth(3);
        doc.roundedRect(15, yPos, 180, 70, 5, 5);
        
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('📊 ESTADÍSTICAS GENERALES', 105, yPos + 12, { align: 'center' });
        
        doc.setDrawColor(201, 169, 97);
        doc.setLineWidth(1);
        doc.line(25, yPos + 18, 185, yPos + 18);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        
        doc.text('Total Estudiantes', 35, yPos + 30);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(201, 169, 97);
        doc.text(totalEstudiantes.toString(), 35, yPos + 45);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text('Total Intentos', 115, yPos + 30);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text(totalIntentos.toString(), 115, yPos + 45);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text('Promedio', 35, yPos + 55);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text(promedioGeneral, 35, yPos + 67);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text('Con Intentos', 115, yPos + 55);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(239, 68, 68);
        doc.text(estudiantesConIntentos.toString(), 115, yPos + 67);
        
        // GRÁFICO
        yPos = 200;
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text('📈 Distribución de Notas', 20, yPos);
        
        const rangosNotas = { '0-3': 0, '4-6': 0, '7-10': 0 };
        intentosFiltrados.forEach(int => {
            const nota = int.nota;
            if (nota <= 3) rangosNotas['0-3']++;
            else if (nota <= 6) rangosNotas['4-6']++;
            else rangosNotas['7-10']++;
        });
        
        const graficoImg = await crearGraficoBarras(
            Object.values(rangosNotas),
            Object.keys(rangosNotas),
            [
                ['#ef4444', '#dc2626'],
                ['#fbbf24', '#f59e0b'],
                ['#10b981', '#059669']
            ]
        );
        
        doc.addImage(graficoImg, 'PNG', 15, yPos + 5, 180, 70);
        
        doc.addPage();
        
        // DETALLES
        yPos = 20;
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('👥 Detalles por Estudiante', 20, yPos);
        yPos += 12;

        estudiantesFiltrados.forEach((estudiante, index) => {
            if (yPos > 255) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFillColor(240, 240, 240);
            doc.roundedRect(16, yPos + 1, 180, 12, 2, 2, 'F');
            
            doc.setFillColor(201, 169, 97);
            doc.roundedRect(15, yPos, 180, 12, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}. ${estudiante.nombre}`, 20, yPos + 8);

            yPos += 16;

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
                doc.setFontSize(11);
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

            yPos += 8;
        });

        // FOOTER
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(201, 169, 97);
            doc.setLineWidth(0.5);
            doc.line(20, 285, 190, 285);
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
            doc.text(`Sparta Academy © ${new Date().getFullYear()}`, 105, 294, { align: 'center' });
        }

        doc.save(`Reporte-General-Sparta-${new Date().getTime()}.pdf`);
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        alert('❌ Error al generar el PDF. Revisa la consola.');
    }
}

async function generarPDFIndividual(usuarioId) {
    try {
        const estudiante = todosLosEstudiantes.find(e => e.usuario === usuarioId);
        if (!estudiante) {
            alert('❌ No se encontró el estudiante');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // PORTADA
        for (let i = 0; i < 80; i++) {
            doc.setFillColor(201 - i, 169 - i, 97 - i);
            doc.rect(0, i, 210, 1, 'F');
        }
        
        doc.setFillColor(201, 169, 97);
        doc.circle(105, 35, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('S', 105, 39, { align: 'center' });
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(34);
        doc.setFont('helvetica', 'bold');
        doc.text('SPARTA ACADEMY', 105, 60, { align: 'center' });
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'normal');
        doc.text('Reporte Individual de Aspirante', 105, 73, { align: 'center' });

        let yPos = 95;

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(15, yPos, 180, 35, 5, 5, 'F');
        doc.setDrawColor(201, 169, 97);
        doc.setLineWidth(3);
        doc.roundedRect(15, yPos, 180, 35, 5, 5);
        
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(estudiante.nombre, 105, yPos + 15, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(`Usuario: ${estudiante.usuario} | Fecha: ${new Date().toLocaleDateString('es-ES')}`, 105, yPos + 27, { align: 'center' });

        yPos += 45;

        const intentosEstudiante = intentosPorEstudiante.get(estudiante.usuario) || [];
        const totalIntentosEst = intentosEstudiante.length;
        const promedioEst = totalIntentosEst > 0
            ? (intentosEstudiante.reduce((sum, i) => sum + i.nota, 0) / totalIntentosEst).toFixed(2)
            : '0.00';
        const mejorNota = totalIntentosEst > 0
            ? Math.max(...intentosEstudiante.map(i => i.nota)).toFixed(1)
            : '0.0';

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(15, yPos, 180, 50, 5, 5, 'F');
        doc.setDrawColor(201, 169, 97);
        doc.setLineWidth(2);
        doc.roundedRect(15, yPos, 180, 50, 5, 5);
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(17, 24, 39);
        doc.text('📊 Estadísticas Personales', 105, yPos + 13, { align: 'center' });
        
        doc.setDrawColor(201, 169, 97);
        doc.line(25, yPos + 18, 185, yPos + 18);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        
        doc.text('Total Intentos:', 30, yPos + 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229);
        doc.text(totalIntentosEst.toString(), 30, yPos + 42);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(107, 114, 128);
        doc.text('Promedio:', 85, yPos + 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(16, 185, 129);
        doc.text(promedioEst, 85, yPos + 42);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(107, 114, 128);
        doc.text('Mejor Nota:', 140, yPos + 30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(201, 169, 97);
        doc.text(mejorNota, 140, yPos + 42);

        yPos += 60;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('🎓 Detalles por Universidad', 20, yPos);
        yPos += 12;

        estudiante.universidades_acceso.forEach(uni => {
            if (yPos > 245) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFillColor(240, 240, 240);
            doc.roundedRect(16, yPos + 1, 180, 12, 2, 2, 'F');
            
            doc.setFillColor(201, 169, 97);
            doc.roundedRect(15, yPos, 180, 12, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text(uni, 20, yPos + 8);

            yPos += 16;

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
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`📚 ${materia}`, 20, yPos);
                    yPos += 7;

                    intentosPorMateria[materia].forEach(intento => {
                        if (yPos > 280) {
                            doc.addPage();
                            yPos = 20;
                        }
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(10);
                        doc.setTextColor(55, 65, 81);
                        const porcentaje = ((intento.nota / (intento.notaMaxima || 10)) * 100).toFixed(0);
                        doc.text(`    • Intento #${intento.intento}: ${intento.nota.toFixed(1)}/${intento.notaMaxima || 10} (${porcentaje}%) | ${intento.fecha} ${intento.hora}`, 25, yPos);
                        yPos += 5;
                    });

                    yPos += 4;
                });
            } else {
                doc.setTextColor(156, 163, 175);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(10);
                doc.text('Sin intentos registrados en esta universidad', 20, yPos);
                yPos += 6;
            }

            yPos += 10;
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(201, 169, 97);
            doc.setLineWidth(0.5);
            doc.line(20, 285, 190, 285);
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
            doc.text(`Sparta Academy © ${new Date().getFullYear()}`, 105, 294, { align: 'center' });
        }

        doc.save(`Reporte-${estudiante.nombre.replace(/\s+/g, '-')}-${new Date().getTime()}.pdf`);

    } catch (error) {
        console.error('Error generando PDF individual:', error);
        alert('❌ Error al generar el PDF. Revisa la consola.');
    }
}
