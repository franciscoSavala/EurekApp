const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = 8080;
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// ─── Tiny 1x1 red pixel PNG in base64 (placeholder for images) ───────────────
const PLACEHOLDER_IMAGE_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

// ─── Mock data ────────────────────────────────────────────────────────────────

const ORGANIZATIONS = [
  { id: 1, name: 'Universidad de Buenos Aires', contactData: 'info@uba.ar' },
  { id: 2, name: 'Hospital Italiano',           contactData: 'info@hospitalitaliano.org.ar' },
  { id: 3, name: 'Biblioteca Nacional',         contactData: 'info@bn.gov.ar' },
];

const USERS = {
  // username → user record
  'user@test.com': {
    id: 1,
    username: 'user@test.com',
    firstName: 'Juan',
    lastName: 'Pérez',
    role: 'REGULAR_USER',
    password: 'Password1!',
    xp: 120,
    returnedObjects: 3,
    organization: null,
  },
  'admin@uba.ar': {
    id: 2,
    username: 'admin@uba.ar',
    firstName: 'María',
    lastName: 'González',
    role: 'ORGANIZATION_OWNER',
    password: 'Password1!',
    xp: 350,
    returnedObjects: 8,
    organization: ORGANIZATIONS[0],
  },
  'empleado@uba.ar': {
    id: 3,
    username: 'empleado@uba.ar',
    firstName: 'Carlos',
    lastName: 'López',
    role: 'ORGANIZATION_EMPLOYEE',
    password: 'Password1!',
    xp: 200,
    returnedObjects: 5,
    organization: ORGANIZATIONS[0],
  },
};

const FOUND_OBJECTS = [
  {
    id: 'fo-uuid-001',
    title: 'Billetera negra de cuero',
    humanDescription: 'Billetera negra de cuero con documentos adentro',
    aiDescription: 'Objeto rectangular de color negro, material cuero, posiblemente una billetera o cartera',
    b64Json: PLACEHOLDER_IMAGE_B64,
    score: 0.92,
    organization: ORGANIZATIONS[0],
    found_date: '2024-11-10T14:30:00',
    latitude: -34.6037,
    longitude: -58.3816,
    distance: 1.2,
    returned: false,
  },
  {
    id: 'fo-uuid-002',
    title: 'Mochila azul',
    humanDescription: 'Mochila azul con logo de la facultad, contiene libros',
    aiDescription: 'Bolso de tela azul con correas, tipo mochila estudiantil',
    b64Json: PLACEHOLDER_IMAGE_B64,
    score: 0.85,
    organization: ORGANIZATIONS[0],
    found_date: '2024-11-12T09:15:00',
    latitude: -34.6118,
    longitude: -58.3960,
    distance: 2.8,
    returned: false,
  },
  {
    id: 'fo-uuid-003',
    title: 'Llaves con llavero rojo',
    humanDescription: 'Juego de llaves con llavero de plástico rojo',
    aiDescription: 'Conjunto de llaves metálicas unidas por un llavero de color rojo',
    b64Json: PLACEHOLDER_IMAGE_B64,
    score: 0.78,
    organization: ORGANIZATIONS[1],
    found_date: '2024-11-08T16:45:00',
    latitude: -34.5995,
    longitude: -58.3978,
    distance: 0.5,
    returned: true,
  },
];

const RETURNED_OBJECTS = [
  {
    id: 'ret-uuid-001',
    username: 'user@test.com',
    DNI: '35123456',
    phoneNumber: '+5491155551234',
    personPhoto_b64Json: PLACEHOLDER_IMAGE_B64,
    foundObjectId: 'fo-uuid-003',
    returnDateTime: '2024-11-09T11:00:00',
  },
];

const LEVELS = [
  { levelName: 'Principiante', requiredXP: 0 },
  { levelName: 'Colaborador',  requiredXP: 100 },
  { levelName: 'Ayudante',     requiredXP: 300 },
  { levelName: 'Experto',      requiredXP: 600 },
  { levelName: 'Héroe',        requiredXP: 1000 },
];

const ACHIEVEMENTS = [
  { achievementName: 'Primera devolución', requiredReturnedObjects: 1 },
  { achievementName: 'Cinco devoluciones', requiredReturnedObjects: 5 },
  { achievementName: 'Diez devoluciones',  requiredReturnedObjects: 10 },
];

const PENDING_REQUESTS = [
  { id: 'req-uuid-001', organizationName: 'Universidad de Buenos Aires' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(method, path, extra = '') {
  const time = new Date().toLocaleTimeString('es-AR');
  console.log(`[${time}] ${method.padEnd(6)} ${path} ${extra}`);
}

function getUserFromToken(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  // Mock tokens are "mock-jwt-{username-base64}"
  try {
    const encoded = token.replace('mock-jwt-', '');
    const username = Buffer.from(encoded, 'base64').toString('utf8');
    return USERS[username] || null;
  } catch {
    return null;
  }
}

function makeToken(username) {
  return 'mock-jwt-' + Buffer.from(username).toString('base64');
}

function userDto(user) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
}

function getCurrentLevel(xp) {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.requiredXP) current = level;
  }
  return current;
}

function getNextLevel(xp) {
  for (const level of LEVELS) {
    if (xp < level.requiredXP) return level;
  }
  return null;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

// POST /login
app.post('/login', (req, res) => {
  log('POST', '/login');
  const { username, password } = req.body;
  const user = USERS[username];

  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
  }

  res.json({
    token: makeToken(username),
    user: userDto(user),
    organization: user.organization,
  });
});

// POST /signup
app.post('/signup', (req, res) => {
  log('POST', '/signup');
  const { firstname, lastname, username, password } = req.body;

  if (USERS[username]) {
    return res.status(400).json({ message: 'El usuario ya existe' });
  }

  const newUser = {
    id: Object.keys(USERS).length + 1,
    username,
    firstName: firstname,
    lastName: lastname,
    role: 'REGULAR_USER',
    password,
    xp: 0,
    returnedObjects: 0,
    organization: null,
  };
  USERS[username] = newUser;

  res.json({
    token: makeToken(username),
    user: userDto(newUser),
    organization: null,
  });
});

// ─── USER ─────────────────────────────────────────────────────────────────────

// GET /user/refreshUserDetails
app.get('/user/refreshUserDetails', (req, res) => {
  log('GET', '/user/refreshUserDetails');
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });

  res.json({
    token: makeToken(user.username),
    user: userDto(user),
    organization: user.organization,
  });
});

// GET /user/achievements
app.get('/user/achievements', (req, res) => {
  log('GET', '/user/achievements');
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });

  const xp = user.xp;
  const returned = user.returnedObjects;
  const earned = ACHIEVEMENTS.filter(a => returned >= a.requiredReturnedObjects);
  const next = ACHIEVEMENTS.find(a => returned < a.requiredReturnedObjects) || null;

  res.json({
    XP: xp,
    currentLevel: getCurrentLevel(xp),
    nextLevel: getNextLevel(xp),
    returnedObjects: returned,
    returnedObjectsAchievements: earned,
    nextReturnedObjectsAchievement: next,
  });
});

// ─── FOUND OBJECTS ────────────────────────────────────────────────────────────

// GET /found-objects  (búsqueda global por coordenadas)
app.get('/found-objects', (req, res) => {
  const { query, lost_date, latitude, longitude } = req.query;
  log('GET', '/found-objects', `query="${query}"`);

  const results = FOUND_OBJECTS
    .filter(fo => !fo.returned)
    .filter(fo => !query || fo.title.toLowerCase().includes(query.toLowerCase()) ||
                            fo.humanDescription.toLowerCase().includes(query.toLowerCase()));

  res.json({ found_objects: results });
});

// GET /found-objects/organizations/all/:orgId  (inventario completo)
// IMPORTANT: must be declared BEFORE the generic /:orgId routes
app.get('/found-objects/organizations/all/:orgId', (req, res) => {
  const { orgId } = req.params;
  log('GET', `/found-objects/organizations/all/${orgId}`);

  const results = FOUND_OBJECTS.filter(
    fo => fo.organization.id === parseInt(orgId) && !fo.returned
  );
  res.json({ found_objects: results });
});

// GET /found-objects/organizations/:orgId  (búsqueda por org)
app.get('/found-objects/organizations/:orgId', (req, res) => {
  const { orgId } = req.params;
  const { query } = req.query;
  log('GET', `/found-objects/organizations/${orgId}`, `query="${query}"`);

  const results = FOUND_OBJECTS
    .filter(fo => fo.organization.id === parseInt(orgId) && !fo.returned)
    .filter(fo => !query || fo.title.toLowerCase().includes(query.toLowerCase()) ||
                            fo.humanDescription.toLowerCase().includes(query.toLowerCase()));

  res.json({ found_objects: results });
});

// POST /found-objects/organizations/:orgId  (subir objeto encontrado)
app.post('/found-objects/organizations/:orgId', upload.single('file'), (req, res) => {
  const { orgId } = req.params;
  log('POST', `/found-objects/organizations/${orgId}`, '(upload)');

  const { title, detailed_description, found_date, latitude, longitude, object_finder_username } = req.body;
  const org = ORGANIZATIONS.find(o => o.id === parseInt(orgId));

  const newObject = {
    id: `fo-uuid-${Date.now()}`,
    title: title || 'Objeto sin título',
    humanDescription: detailed_description || '',
    aiDescription: 'Descripción generada por IA (mock)',
    b64Json: PLACEHOLDER_IMAGE_B64,
    score: 1.0,
    organization: org || ORGANIZATIONS[0],
    found_date: found_date || new Date().toISOString(),
    latitude: parseFloat(latitude) || null,
    longitude: parseFloat(longitude) || null,
    distance: null,
    returned: false,
  };

  FOUND_OBJECTS.push(newObject);

  res.json({
    id: newObject.id,
    textEncoding: 'Objeto procesado correctamente (mock)',
    description: newObject.aiDescription,
  });
});

// POST /found-objects/getDetail
app.post('/found-objects/getDetail', (req, res) => {
  const { foundObjectUUID } = req.body;
  log('POST', '/found-objects/getDetail', `uuid=${foundObjectUUID}`);

  const fo = FOUND_OBJECTS.find(o => o.id === foundObjectUUID);
  if (!fo) return res.status(404).json({ message: 'Objeto no encontrado' });

  res.json(fo);
});

// GET /found-objects/getReturnedObjects
app.get('/found-objects/getReturnedObjects', (req, res) => {
  log('GET', '/found-objects/getReturnedObjects');
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });

  const returnedFOs = FOUND_OBJECTS.filter(fo => fo.returned);
  res.json({ found_objects: returnedFOs });
});

// POST /found-objects/getReturnedObject
app.post('/found-objects/getReturnedObject', (req, res) => {
  const { foundObjectUUID } = req.body;
  log('POST', '/found-objects/getReturnedObject', `uuid=${foundObjectUUID}`);
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });

  const ret = RETURNED_OBJECTS.find(r => r.foundObjectId === foundObjectUUID);
  if (!ret) return res.status(404).json({ message: 'Devolución no encontrada' });

  res.json(ret);
});

// POST /found-objects/return/:orgId  (registrar devolución)
app.post('/found-objects/return/:orgId', upload.single('file'), (req, res) => {
  const { orgId } = req.params;
  log('POST', `/found-objects/return/${orgId}`, '(return)');

  const { username, dni, phoneNumber, found_object_uuid } = req.body;

  const fo = FOUND_OBJECTS.find(o => o.id === found_object_uuid);
  if (!fo) return res.status(404).json({ message: 'Objeto no encontrado' });

  fo.returned = true;

  const returnRecord = {
    id: `ret-uuid-${Date.now()}`,
    username: username || null,
    DNI: dni,
    phoneNumber,
    personPhoto_b64Json: PLACEHOLDER_IMAGE_B64,
    foundObjectId: found_object_uuid,
    returnDateTime: new Date().toISOString(),
  };
  RETURNED_OBJECTS.push(returnRecord);

  res.json(returnRecord);
});

// ─── LOST OBJECTS ─────────────────────────────────────────────────────────────

// POST /lost-objects
app.post('/lost-objects', (req, res) => {
  log('POST', '/lost-objects');
  // Solo registra, no devuelve cuerpo
  res.status(200).send();
});

// ─── ORGANIZATIONS ────────────────────────────────────────────────────────────

// GET /organizations
app.get('/organizations', (req, res) => {
  log('GET', '/organizations');
  res.json({ organizations: ORGANIZATIONS });
});

// POST /organizations  (registrar nueva organización)
app.post('/organizations', (req, res) => {
  log('POST', '/organizations');
  res.status(200).send();
});

// GET /organizations/employees
app.get('/organizations/employees', (req, res) => {
  log('GET', '/organizations/employees');
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });

  const orgId = user.organization?.id;
  const employees = Object.values(USERS).filter(
    u => u.organization?.id === orgId &&
         (u.role === 'ORGANIZATION_EMPLOYEE' || u.role === 'ORGANIZATION_OWNER')
  );

  res.json({ users: employees.map(userDto) });
});

// POST /organizations/add_employee
app.post('/organizations/add_employee', (req, res) => {
  log('POST', '/organizations/add_employee');
  const { employeeUsername } = req.body;
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });

  const target = USERS[employeeUsername];
  if (!target) return res.status(404).json({ message: 'Usuario no encontrado' });

  // Simula envío de solicitud (en el mock solo logueamos)
  console.log(`  → Solicitud enviada a ${employeeUsername} para unirse a ${user.organization?.name}`);
  res.status(200).send();
});

// POST /organizations/delete_employee
app.post('/organizations/delete_employee', (req, res) => {
  log('POST', '/organizations/delete_employee');
  const { userId } = req.body;
  const target = Object.values(USERS).find(u => u.id === parseInt(userId));
  if (!target) return res.status(400).json({ message: 'Usuario no encontrado' });

  target.organization = null;
  target.role = 'REGULAR_USER';
  console.log(`  → ${target.username} removido de la organización`);
  res.status(200).send();
});

// GET /organizations/getPendingAddEmployeeRequests
app.get('/organizations/getPendingAddEmployeeRequests', (req, res) => {
  log('GET', '/organizations/getPendingAddEmployeeRequests');
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ message: 'No autorizado' });

  res.json({ requests: PENDING_REQUESTS });
});

// POST /organizations/acceptAddEmployeeRequest
app.post('/organizations/acceptAddEmployeeRequest', (req, res) => {
  log('POST', '/organizations/acceptAddEmployeeRequest');
  const { id } = req.body;
  const idx = PENDING_REQUESTS.findIndex(r => r.id === id);
  if (idx !== -1) PENDING_REQUESTS.splice(idx, 1);
  res.status(200).send();
});

// POST /organizations/declineAddEmployeeRequest
app.post('/organizations/declineAddEmployeeRequest', (req, res) => {
  log('POST', '/organizations/declineAddEmployeeRequest');
  const { id } = req.body;
  const idx = PENDING_REQUESTS.findIndex(r => r.id === id);
  if (idx !== -1) PENDING_REQUESTS.splice(idx, 1);
  res.status(200).send();
});

// ─── STATS ────────────────────────────────────────────────────────────────────

// GET /stats
app.get('/stats', (req, res) => {
  log('GET', '/stats');
  const allUsers = Object.values(USERS);
  res.json({
    'Organizaciones': ORGANIZATIONS.length,
    'Objetos encontrados': FOUND_OBJECTS.length,
    'Objetos devueltos': RETURNED_OBJECTS.length,
    'Total usuarios': allUsers.length,
    'Usuarios admin de organizaciones': allUsers.filter(u => u.role === 'ORGANIZATION_OWNER').length,
    'Usuarios empleados de organizaciones': allUsers.filter(u => u.role === 'ORGANIZATION_EMPLOYEE').length,
    'Usuarios regulares': allUsers.filter(u => u.role === 'REGULAR_USER').length,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 EurekApp Mock Server corriendo en http://localhost:${PORT}`);
  console.log('\n📋 Usuarios de prueba:');
  console.log('   user@test.com     / Password1!  → REGULAR_USER');
  console.log('   admin@uba.ar      / Password1!  → ORGANIZATION_OWNER (UBA)');
  console.log('   empleado@uba.ar   / Password1!  → ORGANIZATION_EMPLOYEE (UBA)');
  console.log('\n📦 Objetos encontrados precargados: 3 (1 ya devuelto)');
  console.log('─'.repeat(55));
});
