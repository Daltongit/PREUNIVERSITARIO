// ==================== AUTO-REGISTRO DE MATERIAS DESDE ARCHIVOS ====================

const UNIVERSIDADES = ['EPN', 'UCE', 'ESPE', 'UNACH', 'UPEC', 'UTA', 'UTC', 'UTN', 'YACHAY'];

// Mapeo de nombres de archivo a nombres de materia
const MAPEO_MATERIAS = {
    'general1': 'Aptitud Academica 1',
    'general2': 'Aptitud Academica 2',
    'general3': 'Aptitud Academica 3',
    'matematicas': 'Matematicas',
    'matematica': 'Matematicas',
    'lengua': 'Lengua y Literatura',
    'lenguaje': 'Lengua y Literatura',
    'ciencias': 'Ciencias Naturales',
    'fisica': 'Fisica',
    'quimica': 'Quimica',
    'biologia': 'Biologia',
    'ingles': 'Ingles',
    'sociales': 'Ciencias Sociales',
    'historia': 'Historia',
    'geografia': 'Geografia',
    'logica': 'Razonamiento Logico',
    'razonamiento': 'Razonamiento Abstracto',
    'verbal': 'Razonamiento Verbal',
    'numerico': 'Razonamiento Numerico'
};

async function autoRegistrarMaterias() {
    console.log('🔄 Buscando materias en archivos JSON...');
    
    const materiasEncontradas = [];
    
    for (const uni of UNIVERSIDADES) {
        console.log(`📂 Escaneando ${uni}...`);
        
        // Lista de nombres de archivos a buscar
        const archivos = Object.keys(MAPEO_MATERIAS);
        
        for (const archivo of archivos) {
            try {
                const ruta = `universidades/${uni}/data/${archivo}.json`;
                const response = await fetch(ruta);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // Determinar nombre de la materia
                    const nombreMateria = MAPEO_MATERIAS[archivo] || 
                                         archivo.charAt(0).toUpperCase() + archivo.slice(1);
                    
                    const codigo = `${uni}-${archivo.toUpperCase().substring(0, 4)}`;
                    
                    // Verificar si ya existe
                    const { data: existente, error } = await supabaseClient
                        .from('materias')
                        .select('id')
                        .eq('universidad_id', uni)
                        .eq('nombre', nombreMateria)
                        .maybeSingle();
                    
                    if (error && error.code !== 'PGRST116') {
                        console.error(`Error verificando ${nombreMateria}:`, error);
                        continue;
                    }
                    
                    // Si NO existe, agregarla
                    if (!existente) {
                        const { data: nueva, error: errorInsert } = await supabaseClient
                            .from('materias')
                            .insert({
                                nombre: nombreMateria,
                                codigo: codigo,
                                universidad_id: uni,
                                descripcion: `${nombreMateria} - ${uni}`,
                                icono: '📚',
                                activo: true
                            })
                            .select()
                            .single();
                        
                        if (errorInsert) {
                            console.error(`❌ Error insertando ${nombreMateria}:`, errorInsert);
                        } else {
                            console.log(`✅ ${nombreMateria} registrada en ${uni}`);
                            materiasEncontradas.push(nueva);
                        }
                    } else {
                        console.log(`ℹ️ ${nombreMateria} ya existe en ${uni}`);
                    }
                }
            } catch (e) {
                // Archivo no existe, continuar sin mostrar error
            }
        }
    }
    
    if (materiasEncontradas.length > 0) {
        console.log(`✅ ${materiasEncontradas.length} materias nuevas registradas`);
    } else {
        console.log('✅ Todas las materias ya estaban registradas');
    }
    
    return materiasEncontradas;
}

// Ejecutar automáticamente cuando el script cargue
if (typeof supabaseClient !== 'undefined') {
    // Esperar 500ms para que Supabase esté listo
    setTimeout(async () => {
        await autoRegistrarMaterias();
    }, 500);
}

// Exportar para uso manual
window.autoRegistrarMaterias = autoRegistrarMaterias;
