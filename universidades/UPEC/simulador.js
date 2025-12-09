let usuarioActual = null;
let materiaActual = null;
let preguntasExamen = [];
let preguntaIndex = 0;
let respuestasUsuario = [];
let tiempoRestante = 3600;
let intervaloCronometro = null;
let horaInicio = null;
let codigoUniversidad = 'UPEC';

const universidadesInfo = {
    'EPN': { nombre: 'Escuela Politécnica Nacional', logo: 'epn.png' },
    'UCE': { nombre: 'Universidad Central del Ecuador', logo: 'uce.png' },
    'ESPE': { nombre: 'Universidad de las Fuerzas Armadas', logo: 'espe.png' },
    'UNACH': { nombre: 'Universidad Nacional de Chimborazo', logo: 'unach.png' },
    'UPEC': { nombre: 'Universidad Politécnica Estatal del Carchi', logo: 'upec.png' },
    'UTA': { nombre: 'Universidad Técnica de Ambato', logo: 'uta.png' },
    'UTC': { nombre: 'Universidad Técnica de Cotopaxi', logo: 'utc.png' },
    'UTN': { nombre: 'Universidad Técnica del Norte', logo: 'utn.png' },
    'YACHAY': { nombre: 'Universidad Yachay Tech', logo: 'yachay.png' }
};

document.addEventListener('DOMContentLoaded', function () {
    usuarioActual = JSON.parse(sessionStorage.getItem('usuarioActual'));

    if (!usuarioActual) {
        window.location.href = '../../login.html';
        return;
    }

    const headerContent = document.getElementById('headerContent');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    hamburgerBtn.addEventListener('click', () => {
        headerContent.classList.toggle('nav-open');
    });

    const urlParams = new URLSearchParams(window.location.search);
    const uniParam = urlParams.get('uni');
    if (uniParam) codigoUniversidad = uniParam;

    const uniInfo = universidadesInfo[codigoUniversidad];
    if (uniInfo) {
        document.getElementById('uniLogo').src = `../../assets/logos/${uniInfo.logo}`;
        document.getElementById('simuladorTitulo').textContent = `Simuladores Sparta Academy – ${codigoUniversidad}`;
        document.getElementById('simuladorSubtitulo').textContent = uniInfo.nombre;
    }

    document.getElementById('userName').textContent = usuarioActual.nombre;

    const materias = [
        { nombre: 'Matemáticas', icono: '∑', desc: 'Razonamiento, álgebra y problemas numéricos.' },
        { nombre: 'Física', icono: '⚛', desc: 'Movimiento, fuerzas, energía y ondas.' },
        { nombre: 'Química', icono: '🧪', desc: 'Estructura de la materia y reacciones.' }
    ];

    const materiaGrid = document.getElementById('materiaGrid');
    materias.forEach(m => {
        const card = document.createElement('div');
        card.className = 'materia-card';
        card.innerHTML = `
            <div class="materia-icon-circle">${m.icono}</div>
            <div class="materia-content">
                <div class="materia-title">${m.nombre}</div>
                <div class="materia-desc">${m.desc}</div>
            </div>
            <div class="materia-graphic"></div>
        `;
        card.addEventListener('click', () => seleccionarMateria(m.nombre));
        materiaGrid.appendChild(card);
    });

    document.getElementById('btnVolver').addEventListener('click', () => window.location.href = '../../index.html');
    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
    document.getElementById('btnComenzar').addEventListener('click', comenzarExamen);
    document.getElementById('btnSiguiente').addEventListener('click', siguientePregunta);
    document.getElementById('btnOtroIntento').addEventListener('click', reiniciarSimulador);
    document.getElementById('btnVolverInicio').addEventListener('click', () => window.location.href = '../../index.html');
    
    document.getElementById('btnTerminarAhora').addEventListener('click', () => {
        document.getElementById('modalConfirmar').classList.add('active');
    });

    const modalConfirmar = document.getElementById('modalConfirmar');
    const btnCancelarTerminar = document.getElementById('btnCancelarTerminar');
    const btnConfirmarTerminar = document.getElementById('btnConfirmarTerminar');

    btnCancelarTerminar.addEventListener('click', () => {
        modalConfirmar.classList.remove('active');
    });

    btnConfirmarTerminar.addEventListener('click', () => {
        modalConfirmar.classList.remove('active');
        finalizarExamen();
    });

    modalConfirmar.addEventListener('click', (e) => {
        if (e.target === modalConfirmar) {
            modalConfirmar.classList.remove('active');
        }
    });
});

function seleccionarMateria(materia) {
    materiaActual = materia;
    document.getElementById('materiaNombre').textContent = `Materia: ${materia}`;
    document.getElementById('materiaSelector').style.display = 'none';
    
    cargarPreviewPreguntas(materia);
}

async function cargarPreviewPreguntas(materia) {
    try {
        const materiaFile = materia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const response = await fetch(`data/${materiaFile}.json`);
        const todasPreguntas = await response.json();
        
        document.getElementById('numPreguntas').textContent = todasPreguntas.length;
        document.getElementById('instrucciones').classList.add('active');
    } catch (error) {
        console.error('Error al cargar preguntas:', error);
        alert('Error al cargar el examen. Intenta nuevamente.');
    }
}

async function comenzarExamen() {
    try {
        const materiaFile = materiaActual.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const response = await fetch(`data/${materiaFile}.json`);
        const todasPreguntas = await response.json();

        preguntasExamen = todasPreguntas.sort(() => Math.random() - 0.5);
        respuestasUsuario = new Array(preguntasExamen.length).fill(null);
        preguntaIndex = 0;
        horaInicio = new Date();
        tiempoRestante = 3600;

        document.getElementById('instrucciones').classList.remove('active');
        document.getElementById('examenLayout').classList.add('active');

        generarNavegacionPreguntas();
        iniciarCronometro();
        mostrarPregunta();
    } catch (error) {
        console.error('Error al cargar preguntas:', error);
        alert('Error al cargar el examen. Intenta nuevamente.');
    }
}

function generarNavegacionPreguntas() {
    const grid = document.getElementById('preguntasGrid');
    grid.innerHTML = '';
    for (let i = 0; i < preguntasExamen.length; i++) {
        const btn = document.createElement('button');
        btn.className = 'pregunta-nav-btn';
        btn.textContent = i + 1;
        btn.id = `nav-btn-${i}`;
        grid.appendChild(btn);
    }
}

function actualizarNavegacion() {
    for (let i = 0; i < preguntasExamen.length; i++) {
        const btn = document.getElementById(`nav-btn-${i}`);
        btn.classList.remove('actual', 'contestada');
        if (i === preguntaIndex) btn.classList.add('actual');
        else if (respuestasUsuario[i] !== null) btn.classList.add('contestada');
    }
}

function iniciarCronometro() {
    clearInterval(intervaloCronometro);
    intervaloCronometro = setInterval(() => {
        tiempoRestante--;
        const minutos = Math.floor(tiempoRestante / 60);
        const segundos = tiempoRestante % 60;
        document.getElementById('cronometro').textContent =
            `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;

        if (tiempoRestante <= 0) {
            clearInterval(intervaloCronometro);
            finalizarExamen();
        }
    }, 1000);
}

function mostrarPregunta() {
    const pregunta = preguntasExamen[preguntaIndex];
    const container = document.getElementById('preguntaActual');

    let html = `
        <div class="pregunta-numero">Pregunta ${preguntaIndex + 1} de ${preguntasExamen.length}</div>
        <div class="pregunta-texto">${pregunta.pregunta}</div>
        <div class="opciones">
    `;

    for (const [letra, texto] of Object.entries(pregunta.opciones)) {
        const selected = respuestasUsuario[preguntaIndex] === letra ? 'selected' : '';
        html += `
            <div class="opcion ${selected}" data-opcion="${letra}">
                <strong>${letra})</strong> ${texto}
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;

    document.querySelectorAll('.opcion').forEach(opcion => {
        opcion.addEventListener('click', function () {
            document.querySelectorAll('.opcion').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            respuestasUsuario[preguntaIndex] = this.dataset.opcion;
            actualizarNavegacion();
        });
    });

    actualizarNavegacion();
}

function siguientePregunta() {
    if (preguntaIndex < preguntasExamen.length - 1) {
        preguntaIndex++;
        mostrarPregunta();
    } else {
        document.getElementById('modalConfirmar').classList.add('active');
    }
}

async function finalizarExamen() {
    clearInterval(intervaloCronometro);

    let correctas = 0;
    let incorrectas = 0;
    let enBlanco = 0;

    const revision = preguntasExamen.map((pregunta, index) => {
        const respuestaUsuario = respuestasUsuario[index];
        const esCorrecta = respuestaUsuario === pregunta.respuesta_correcta;

        if (!respuestaUsuario) enBlanco++;
        else if (esCorrecta) correctas++;
        else incorrectas++;

        return {
            pregunta: pregunta.pregunta,
            respuestaUsuarioLetra: respuestaUsuario || 'Sin responder',
            respuestaUsuarioTexto: respuestaUsuario ? pregunta.opciones[respuestaUsuario] : 'Sin responder',
            respuestaCorrectaLetra: pregunta.respuesta_correcta,
            respuestaCorrectaTexto: pregunta.opciones[pregunta.respuesta_correcta],
            esCorrecta
        };
    });

    const puntajePorPregunta = 1000 / preguntasExamen.length;
    let puntajeBruto = correctas * puntajePorPregunta;
    let puntaje = Math.round(puntajeBruto);
    
    if (correctas === preguntasExamen.length) {
        puntaje = 1000;
    }

    await guardarIntento(puntaje, correctas, incorrectas, enBlanco, revision);
    mostrarResultados(puntaje, correctas, incorrectas, enBlanco, revision);
}

async function guardarIntento(puntaje, correctas, incorrectas, enBlanco, revision) {
    const horaFin = new Date();
    try {
        const { error } = await supabaseClient.from('intentos').insert([{
            usuario: usuarioActual.usuario,
            nombre_completo: usuarioActual.nombre,
            ciudad: usuarioActual.ciudad,
            universidad_codigo: codigoUniversidad,
            materia_nombre: materiaActual,
            puntaje_obtenido: puntaje,
            total_preguntas: preguntasExamen.length,
            correctas, incorrectas, en_blanco: enBlanco,
            tiempo_inicio: horaInicio.toISOString(),
            tiempo_fin: horaFin.toISOString(),
            respuestas: revision
        }]);
        if (error) console.error('Error al guardar intento:', error);
    } catch (err) { console.error('Error:', err); }
}

function mostrarResultados(puntaje, correctas, incorrectas, enBlanco, revision) {
    document.getElementById('examenLayout').classList.remove('active');
    document.getElementById('resultadosContainer').classList.add('active');

    document.getElementById('puntajeFinal').textContent = `${puntaje}/1000`;

    document.getElementById('estadisticas').innerHTML = `
        <div class="estadistica"><h3>${preguntasExamen.length}</h3><p>Total de Preguntas</p></div>
        <div class="estadistica"><h3>${correctas}</h3><p>Correctas</p></div>
        <div class="estadistica"><h3>${incorrectas}</h3><p>Incorrectas</p></div>
        <div class="estadistica"><h3>${enBlanco}</h3><p>En Blanco</p></div>
    `;

    let revisionHTML = '';
    revision.forEach((item, index) => {
        revisionHTML += `
            <div class="revision-pregunta">
                <strong>Pregunta ${index + 1}:</strong> ${item.pregunta.replace(/\n/g, '<br>')}<br><br>
                
                ${item.respuestaUsuarioLetra === 'Sin responder' 
                    ? '<span class="respuesta-incorrecta">❌ No respondiste esta pregunta.</span>' 
                    : item.esCorrecta 
                        ? `<span class="respuesta-correcta">✅ Escogiste la respuesta correcta: <strong>${item.respuestaUsuarioTexto}</strong></span>` 
                        : `<span class="respuesta-incorrecta">❌ Escogiste la respuesta incorrecta: <strong>${item.respuestaUsuarioTexto}</strong></span>`
                }
                
                ${!item.esCorrecta && item.respuestaUsuarioLetra !== 'Sin responder' 
                    ? `<br><span class="respuesta-correcta">✓ La respuesta correcta era: <strong>${item.respuestaCorrectaTexto}</strong></span>` 
                    : item.respuestaUsuarioLetra === 'Sin responder' 
                        ? `<br><span class="respuesta-correcta">✓ La respuesta correcta era: <strong>${item.respuestaCorrectaTexto}</strong></span>` 
                        : ''
                }
            </div>
        `;
    });

    document.getElementById('revisionPreguntas').innerHTML = revisionHTML;
}

function reiniciarSimulador() {
    tiempoRestante = 3600;
    preguntaIndex = 0;
    respuestasUsuario = [];
    preguntasExamen = [];

    document.getElementById('resultadosContainer').classList.remove('active');
    document.getElementById('materiaSelector').style.display = 'block';
    document.getElementById('instrucciones').classList.remove('active');
    document.getElementById('examenLayout').classList.remove('active');
}

function cerrarSesion() {
    sessionStorage.removeItem('usuarioActual');
    window.location.href = '../../login.html';
}
