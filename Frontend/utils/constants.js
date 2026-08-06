export const ROLE_LABELS = {
    EMPLOYEE: 'Empleado',
    ORGANIZATION_EMPLOYEE: 'Empleado',
    ENCARGADO: 'Encargado',
    ORGANIZATION_OWNER: 'Dueño de organización',
    USER: 'Usuario',
};

// Categorías DURAS del rework (EU-322). Tienen que ser EXACTAMENTE las del enum ObjectCategory del
// backend: el filtro compara el valor tal cual contra lo guardado, así que una categoría que el
// backend no conoce no "cae en otra" — no matchea con nada y la búsqueda vuelve vacía sin explicar
// por qué. Antes había DOCUMENTOS y ACCESORIOS (que ya no existen) y faltaba BILLETERA.
export const CATEGORIES = [
    { value: 'ELECTRONICA', label: 'Electrónica' },
    { value: 'ROPA', label: 'Ropa' },
    { value: 'BILLETERA', label: 'Billetera y documentos' },
    { value: 'LLAVES', label: 'Llaves' },
    { value: 'OTROS', label: 'Otros' },
];

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));
