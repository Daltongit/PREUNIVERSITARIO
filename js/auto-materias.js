// ==================== AUTO-REGISTRO DE MATERIAS ====================
// Detecta archivos JSON y los registra automáticamente en Supabase

const UNIVERSIDADES = ['EPN', 'UCE', 'ESPE', 'UNACH', 'UPEC', 'UTA', 'UTC', 'UTN', 'YACHAY'];

async function autoRegistrarMaterias() {
    console.log('🔄 Buscando materias nuevas...');
    
    for (const uni of UNIVERSIDADES) {
        // Lista de archivos comunes
        const archivos = ['general1', 'general2', 'matematicas', 'lengua', 'ciencias', 'fisica', 'quimica', 'biologia', 'ingles', 'sociales'];
        
        for (const archivo of archivos) {
            try {
                const response = await fetch(`universidades/${uni}/data/${archivo}.json`);
                if (response.ok) {
                    const data = await response.json();
                    
                    // Nombre de la materia
                    const nombre = data.materia || data.nombre || archivo.charAt(0).toUpperCase() + archivo.slice(1);
                    const codigo = `${uni}-${nombre.substring(0, 4).toUpperCase()}`;
                    
                    // Verificar si ya existe
                    const { data: existente } = await supabaseClient
                        .from('materias')
                        .select('id')
                        .eq('universidad_id', uni)
                        .eq('nombre', nombre)
                        .single();
                    
                    // Si NO existe, agregarla
                    if (!existente) {
                        await supabaseClient.from('materias').insert({
                            nombre: nombre,
                            codigo: codigo,
                            universidad_id: uni,
                            descripcion: `Materia de ${uni}`,
                            icono: '📚',
                            activo: true
                        });
                        console.log(`✅ ${nombre} registrada en ${uni}`);
                    }
                }
            } catch (e) {
                // Archivo no existe, continuar
            }
        }
    }
    console.log('✅ Auto-registro completado');
}

// Ejecutar automáticamente
if (typeof supabaseClient !== 'undefined') {
    autoRegistrarMaterias();
}
