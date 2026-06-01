export const ROLE_LABELS = {
    EMPLOYEE: 'Empleado',
    ORGANIZATION_EMPLOYEE: 'Empleado',
    ENCARGADO: 'Encargado',
    ORGANIZATION_OWNER: 'Responsable de organización',
    USER: 'Usuario',
};

export const CATEGORIES = [
    { value: 'ELECTRONICA', label: 'Electrónica' },
    { value: 'ROPA', label: 'Ropa' },
    { value: 'DOCUMENTOS', label: 'Documentos' },
    { value: 'LLAVES', label: 'Llaves' },
    { value: 'ACCESORIOS', label: 'Accesorios' },
    { value: 'OTROS', label: 'Otros' },
];

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));
