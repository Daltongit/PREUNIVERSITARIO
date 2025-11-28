let usuarioActual = null;
let materiaActual = null;
let preguntasExamen = [];
let preguntaIndex = 0;
let respuestasUsuario = [];
let tiempoRestante = 3600; // 60 minutos en segundos
let intervaloCronometro = null;
let horaInicio = null;

document.addEventListener('DOMContentLoaded', async function () {
    usuarioActual = JSON.parse(sessionStorage.getItem('usuarioActual'));

    if (!usuarioActual) {
        window.location.href = '../../login.html';
        return;
    }

    document.getElementById('userName').textContent = usuarioActual.nombre;

    // Materias disponibles para UPEC
    const materias = ['Matemáticas', 'Física', 'Química'];
    const materiaGrid = document.getElementById('materiaGrid');

    materias.forEach(materia => {
        const card = document.createElement('div');
        card.className = 'materia-card';
        card.textContent = materia;
        card.addEventListener('click', () => seleccionarMateria(materia));
        materiaGrid.appendChild(card);
    });

    document.getElementById('btnVolver').addEventListener('click', () => window.location.href = '../../index.html');
    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
    document.getElementById('btnComenzar').addEventListener('click', comenzarExamen);
    document.getElementById('btnSiguiente').addEventListener('click', siguientePregunta);
    document.getElementById('btnOtroIntento').addEventListener('click', reiniciarSimulador);
    document.getElementById('btnVolverInicio').addEventListener('click', () => window.location.href = '../../index.html');
});

function seleccionarMateria(materia) {
    materiaActual = materia;
    document.getElementById('materiaNombre').textContent = `Materia: ${materia}`;
    document.getElementById('materiaSelector').style.display = 'none';
    document.getElementById('instrucciones').classList.add('active');
}

async function comenzarExamen() {
    try {
        // Cargar preguntas desde archivo JSON
        const materiaFile = materiaActual.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const response = await fetch(`data/${materiaFile}.json`);
        const todasPreguntas = await response.json();

        // Mezclar y seleccionar 50 preguntas (o todas si hay menos de 50)
        preguntasExamen = todasPreguntas.sort(() => Math.random() - 0.5).slice(0, Math.min(50, todasPreguntas.length));

        respuestasUsuario = new Array(preguntasExamen.length).fill(null);
        preguntaIndex = 0;
        horaInicio = new Date();

        document.getElementById('instrucciones').classList.remove('active');
        document.getElementById('examenContainer').classList.add('active');
        document.getElementById('cronometro').style.display = 'block';

        iniciarCronometro();
        mostrarPregunta();

    } catch (error) {
        console.error('Error al cargar preguntas:', error);
        alert('Error al cargar el examen. Intenta nuevamente.');
    }
}

function iniciarCronometro() {
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
        });
    });

    const btnSiguiente = document.getElementById('btnSiguiente');
    if (preguntaIndex === preguntasExamen.length - 1) {
        btnSiguiente.textContent = 'Terminar Examen';
        btnSiguiente.classList.add('btn-terminar');
    } else {
        btnSiguiente.textContent = 'Siguiente';
        btnSiguiente.classList.remove('btn-terminar');
    }
}

function siguientePregunta() {
    if (preguntaIndex === preguntasExamen.length - 1) {
        if (confirm('¿Estás seguro que quieres terminar el intento?')) {
            finalizarExamen();
        }
    } else {
        preguntaIndex++;
        mostrarPregunta();
    }
}

async function finalizarExamen() {
    clearInterval(intervaloCronometro);
    document.getElementById('cronometro').style.display = 'none';

    let correctas = 0;
    let incorrectas = 0;
    let enBlanco = 0;

    const revision = preguntasExamen.map((pregunta, index) => {
        const respuestaUsuario = respuestasUsuario[index];
        const esCorrecta = respuestaUsuario === pregunta.respuesta_correcta;

        if (!respuestaUsuario) {
            enBlanco++;
        } else if (esCorrecta) {
            correctas++;
        } else {
            incorrectas++;
        }

        return {
            pregunta: pregunta.pregunta,
            respuestaUsuario: respuestaUsuario || 'Sin responder',
            respuestaCorrecta: pregunta.respuesta_correcta,
            esCorrecta: esCorrecta
        };
    });

    const puntaje = Math.round((correctas / preguntasExamen.length) * 1000);

    await guardarIntento(puntaje, correctas, incorrectas, enBlanco, revision);

    mostrarResultados(puntaje, correctas, incorrectas, enBlanco, revision);
}

async function guardarIntento(puntaje, correctas, incorrectas, enBlanco, revision) {
    const horaFin = new Date();

    try {
        const { data, error } = await supabaseClient
            .from('intentos')
            .insert([{
                usuario: usuarioActual.usuario,
                nombre_completo: usuarioActual.nombre,
                ciudad: usuarioActual.ciudad,
                universidad_codigo: 'UPEC',
                materia_nombre: materiaActual,
                puntaje_obtenido: puntaje,
                total_preguntas: preguntasExamen.length,
                correctas: correctas,
                incorrectas: incorrectas,
                en_blanco: enBlanco,
                tiempo_inicio: horaInicio.toISOString(),
                tiempo_fin: horaFin.toISOString(),
                respuestas: revision
            }]);

        if (error) {
            console.error('Error al guardar intento:', error);
        } else {
            console.log('Intento guardado exitosamente');
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

function mostrarResultados(puntaje, correctas, incorrectas, enBlanco, revision) {
    document.getElementById('examenContainer').classList.remove('active');
    document.getElementById('resultadosContainer').classList.add('active');

    document.getElementById('puntajeFinal').textContent = `${puntaje}/1000`;

    document.getElementById('estadisticas').innerHTML = `
        <div class="estadistica">
            <h3>${preguntasExamen.length}</h3>
            <p>Total de Preguntas</p>
        </div>
        <div class="estadistica">
            <h3>${correctas}</h3>
            <p>Correctas</p>
        </div>
        <div class="estadistica">
            <h3>${incorrectas}</h3>
            <p>Incorrectas</p>
        </div>
        <div class="estadistica">
            <h3>${enBlanco}</h3>
            <p>En Blanco</p>
        </div>
    `;

    let revisionHTML = '';
    revision.forEach((item, index) => {
        const clase = item.esCorrecta ? 'respuesta-correcta' : 'respuesta-incorrecta';
        revisionHTML += `
            <div class="revision-pregunta">
                <strong>Pregunta ${index + 1}:</strong> ${item.pregunta}<br>
                <span class="${clase}">Tu respuesta: ${item.respuestaUsuario}</span><br>
                ${!item.esCorrecta ? `<span class="respuesta-correcta">Respuesta correcta: ${item.respuestaCorrecta}</span>` : ''}
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
}

function cerrarSesion() {
    sessionStorage.removeItem('usuarioActual');
    window.location.href = '../../login.html';
}
