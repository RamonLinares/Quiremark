import express from 'express';
import cors from 'cors';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fm from 'front-matter';
import { marked } from 'marked';
import { execFile } from 'child_process';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Load environmental variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS || 8 * 60 * 60 * 1000);
const sessionStore = new Map();
const { window } = new JSDOM('');
const DOMPurify = createDOMPurify(window);

const SAFE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_BRANCH_RE = /^(?!.*\.\.)(?!.*\/\/)(?!.*@\{)(?!\/)(?!.*\/$)[A-Za-z0-9._/-]{1,128}$/;
const SAFE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);
const DYNAMIC_VARIABLE_RE = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const DEFAULT_LOCALE = 'en';
const SUPPORTED_LOCALES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português'
};
const THEME_TEXT_KEYS = [
  'searchLabel',
  'searchPlaceholder',
  'searchNoResults',
  'emptyState',
  'readMoreLabel',
  'backLinkLabel',
  'statusLabel',
  'editionLabel',
  'terminalTitle',
  'footerTerminalTitle',
  'newsletterDescription',
  'newsletterSubmitLabel',
  'newsletterPlaceholder',
  'newsletterDisabledPlaceholder',
  'newsletterDisabledLabel',
  'newsletterEmailLabel',
  'footerRights',
  'footerCreditLabel',
  'footerCreditText',
  'footerCreditUrl'
];
const LONG_THEME_TEXT_KEYS = new Set(['newsletterDescription', 'footerRights']);
const REQUIRED_TEMPLATE_FIELDS = [
  'siteName',
  'siteSubtitle',
  'authorName',
  'authorBio',
  'authorAvatar',
  'socialLinks',
  'locale',
  'themeText',
  'widgets',
  'helpers',
  'pageMeta',
  'variables',
  'posts'
];
const REQUIRED_TEMPLATE_HELPERS = [
  'upper',
  't',
  'copy',
  'date',
  'isoDate',
  'seoHead',
  'longDate'
];
const TRANSLATIONS = {
  es: {
    'Home': 'Inicio',
    'VOL.': 'VOL.',
    'NO.': 'N.º',
    'Search Archive': 'Buscar en el archivo',
    'Search posts, categories, or tags...': 'Buscar publicaciones, categorías o etiquetas...',
    'No matching posts found.': 'No se encontraron publicaciones coincidentes.',
    'No posts published yet.': 'Aún no hay publicaciones.',
    '[ERROR: NO_POSTS_FOUND_IN_SECTOR]': '[ERROR: NO_HAY_PUBLICACIONES_EN_EL_SECTOR]',
    'NO ARTICLES REGISTERED IN ARCHIVES.': 'NO HAY ARTÍCULOS REGISTRADOS EN EL ARCHIVO.',
    'No publications found in the forest archives.': 'No se encontraron publicaciones en los archivos del bosque.',
    'NO STATIC DATA SECTORS DETECTED.': 'NO SE DETECTARON SECTORES DE DATOS ESTÁTICOS.',
    'Read Entry →': 'Leer entrada →',
    'Explore Article →': 'Explorar artículo →',
    '[ EXECUTE_POST_READER ]': '[ EJECUTAR_LECTOR ]',
    'READ FULL STORY →': 'LEER HISTORIA COMPLETA →',
    'CONTINUE READING': 'SEGUIR LEYENDO',
    'LOAD ARTICLE_': 'CARGAR ARTÍCULO_',
    '← Back to Musings': '← Volver a reflexiones',
    '← Back to Dashboard': '← Volver al panel',
    '[ BACK_TO_DIRECTORY ]': '[ VOLVER_AL_DIRECTORIO ]',
    '← BACK TO GAZETTE DIRECTORY': '← VOLVER AL DIRECTORIO DE LA GACETA',
    '← BACK TO TREE HIERARCHY': '← VOLVER A LA JERARQUÍA',
    'System Status: ONLINE': 'Estado del sistema: EN LÍNEA',
    'EDITION: DIGITAL AESTHETICS': 'EDICIÓN: ESTÉTICA DIGITAL',
    'Subscribe for the latest design & dev updates directly to your inbox.': 'Suscríbete para recibir las últimas novedades de diseño y desarrollo en tu correo.',
    'Subscribe for weekly drops of design, coding, and futuristic aesthetics.': 'Suscríbete a entregas semanales de diseño, código y estética futurista.',
    'CONNECT TO SECTOR NEWSLETTER STREAM.': 'CONECTAR AL FLUJO DE BOLETÍN DEL SECTOR.',
    'Subscribe to our wire updates. Delivered instantly to your visual cortex.': 'Suscríbete a nuestras actualizaciones. Entrega instantánea a tu córtex visual.',
    'Join the clearing. Receive our monthly letter on art, design, and mindful living.': 'Únete al claro. Recibe nuestra carta mensual sobre arte, diseño y vida consciente.',
    'Subscribe to transmit the latest digital aesthetic logs directly to your matrix terminal.': 'Suscríbete para transmitir los últimos registros de estética digital a tu terminal matriz.',
    'Your email address': 'Tu correo electrónico',
    'Email address': 'Correo electrónico',
    'admin@domain.com': 'admin@dominio.com',
    'your.email@wire.com': 'tu.email@cable.com',
    'your.email@nature.com': 'tu.email@naturaleza.com',
    'SYSTEM@DOMAIN.EXE': 'SISTEMA@DOMINIO.EXE',
    'Subscribe': 'Suscribirse',
    'SUBSCRIBE': 'SUSCRIBIRSE',
    '[ INJECT ]': '[ INYECTAR ]',
    'JOIN LETTERS': 'UNIRSE',
    'TRANSMIT': 'TRANSMITIR',
    'Configure newsletter endpoint': 'Configura el endpoint del boletín',
    'CONFIGURE_ENDPOINT': 'CONFIGURAR_ENDPOINT',
    'CONFIGURE WIRE ENDPOINT': 'CONFIGURAR ENDPOINT',
    'CONFIGURE_ENDPOINT.EXE': 'CONFIGURAR_ENDPOINT.EXE',
    'Configure': 'Configurar',
    'CONFIGURE': 'CONFIGURAR',
    '[ CONFIG ]': '[ CONFIGURAR ]',
    'CONFIG': 'CONFIGURAR',
    'Email Address': 'Correo electrónico',
    'Terminal Email Address': 'Correo de terminal',
    'Newsletter input': 'Entrada del boletín',
    'E-mail for newsletter': 'Correo para el boletín',
    'Neon Email Terminal': 'Terminal de correo neón',
    'All rights reserved.': 'Todos los derechos reservados.',
    'ALL RIGHTS SECURED.': 'TODOS LOS DERECHOS ASEGURADOS.',
    'UNCOMPROMISING DIGITAL DISPATCH.': 'DESPACHO DIGITAL SIN CONCESIONES.',
    'SUSTAINED IN HARMONY WITH DIGITAL ECOSYSTEMS.': 'SOSTENIDO EN ARMONÍA CON ECOSISTEMAS DIGITALES.',
    'ALL PROTOCOLS SECURED.': 'TODOS LOS PROTOCOLOS ASEGURADOS.',
    'Powered by': 'Creado con',
    'POWERED BY': 'CREADO CON',
    'COMPILED_BY:': 'COMPILADO_POR:',
    'DESIGNED ON': 'DISEÑADO EN',
    'SYSTEM_ENGINE:': 'MOTOR_DEL_SISTEMA:',
    'NAME:': 'NOMBRE:',
    'About Me': 'Sobre mí',
    'Recent Posts': 'Publicaciones recientes',
    'Recent Musings': 'Reflexiones recientes',
    'Topics': 'Temas',
    'Newsletter': 'Boletín',
    'Inner Circle Newsletter': 'Boletín del círculo interno',
    'Custom HTML Block': 'Bloque HTML personalizado',
    'Enter your email...': 'Introduce tu correo...',
    'Enter your email for weekly updates...': 'Introduce tu correo para recibir novedades semanales...'
  },
  fr: {
    'Home': 'Accueil',
    'VOL.': 'VOL.',
    'NO.': 'N°',
    'Search Archive': 'Rechercher dans les archives',
    'Search posts, categories, or tags...': 'Rechercher des articles, catégories ou tags...',
    'No matching posts found.': 'Aucun article correspondant trouvé.',
    'No posts published yet.': 'Aucun article publié pour le moment.',
    '[ERROR: NO_POSTS_FOUND_IN_SECTOR]': '[ERREUR: AUCUN_ARTICLE_DANS_LE_SECTEUR]',
    'NO ARTICLES REGISTERED IN ARCHIVES.': 'AUCUN ARTICLE ENREGISTRÉ DANS LES ARCHIVES.',
    'No publications found in the forest archives.': 'Aucune publication trouvée dans les archives forestières.',
    'NO STATIC DATA SECTORS DETECTED.': 'AUCUN SECTEUR DE DONNÉES STATIQUES DÉTECTÉ.',
    'Read Entry →': 'Lire l’entrée →',
    'Explore Article →': 'Explorer l’article →',
    '[ EXECUTE_POST_READER ]': '[ LANCER_LECTEUR ]',
    'READ FULL STORY →': 'LIRE L’ARTICLE COMPLET →',
    'CONTINUE READING': 'CONTINUER LA LECTURE',
    'LOAD ARTICLE_': 'CHARGER_ARTICLE_',
    '← Back to Musings': '← Retour aux réflexions',
    '← Back to Dashboard': '← Retour au tableau',
    '[ BACK_TO_DIRECTORY ]': '[ RETOUR_AU_RÉPERTOIRE ]',
    '← BACK TO GAZETTE DIRECTORY': '← RETOUR AU RÉPERTOIRE DE LA GAZETTE',
    '← BACK TO TREE HIERARCHY': '← RETOUR À LA HIÉRARCHIE',
    'System Status: ONLINE': 'État du système : EN LIGNE',
    'EDITION: DIGITAL AESTHETICS': 'ÉDITION : ESTHÉTIQUE NUMÉRIQUE',
    'Subscribe for the latest design & dev updates directly to your inbox.': 'Abonnez-vous pour recevoir les dernières nouvelles design et dev.',
    'Subscribe for weekly drops of design, coding, and futuristic aesthetics.': 'Abonnez-vous aux envois hebdomadaires de design, code et esthétique futuriste.',
    'CONNECT TO SECTOR NEWSLETTER STREAM.': 'CONNEXION AU FLUX NEWSLETTER DU SECTEUR.',
    'Subscribe to our wire updates. Delivered instantly to your visual cortex.': 'Abonnez-vous à nos dépêches. Livraison instantanée à votre cortex visuel.',
    'Join the clearing. Receive our monthly letter on art, design, and mindful living.': 'Rejoignez la clairière. Recevez notre lettre mensuelle sur l’art, le design et la vie consciente.',
    'Subscribe to transmit the latest digital aesthetic logs directly to your matrix terminal.': 'Abonnez-vous pour transmettre les derniers journaux esthétiques numériques à votre terminal matriciel.',
    'Your email address': 'Votre adresse e-mail',
    'Email address': 'Adresse e-mail',
    'Subscribe': 'S’abonner',
    'SUBSCRIBE': 'S’ABONNER',
    '[ INJECT ]': '[ INJECTER ]',
    'JOIN LETTERS': 'REJOINDRE',
    'TRANSMIT': 'TRANSMETTRE',
    'Configure newsletter endpoint': 'Configurer le point de terminaison',
    'Configure': 'Configurer',
    'CONFIGURE': 'CONFIGURER',
    '[ CONFIG ]': '[ CONFIGURER ]',
    'CONFIG': 'CONFIGURER',
    'Email Address': 'Adresse e-mail',
    'Terminal Email Address': 'Adresse e-mail terminal',
    'Newsletter input': 'Champ newsletter',
    'E-mail for newsletter': 'E-mail pour la newsletter',
    'Neon Email Terminal': 'Terminal e-mail néon',
    'All rights reserved.': 'Tous droits réservés.',
    'ALL RIGHTS SECURED.': 'TOUS DROITS SÉCURISÉS.',
    'UNCOMPROMISING DIGITAL DISPATCH.': 'DÉPÊCHE NUMÉRIQUE SANS COMPROMIS.',
    'SUSTAINED IN HARMONY WITH DIGITAL ECOSYSTEMS.': 'SOUTENU EN HARMONIE AVEC LES ÉCOSYSTÈMES NUMÉRIQUES.',
    'ALL PROTOCOLS SECURED.': 'TOUS LES PROTOCOLES SÉCURISÉS.',
    'Powered by': 'Propulsé par',
    'POWERED BY': 'PROPULSÉ PAR',
    'COMPILED_BY:': 'COMPILÉ_PAR :',
    'DESIGNED ON': 'CONÇU SUR',
    'SYSTEM_ENGINE:': 'MOTEUR_SYSTÈME :',
    'NAME:': 'NOM :',
    'About Me': 'À propos',
    'Recent Posts': 'Articles récents',
    'Recent Musings': 'Réflexions récentes',
    'Topics': 'Sujets',
    'Newsletter': 'Newsletter',
    'Inner Circle Newsletter': 'Newsletter du cercle privé',
    'Custom HTML Block': 'Bloc HTML personnalisé',
    'admin@domain.com': 'admin@domaine.com',
    'your.email@wire.com': 'votre.email@fil.com',
    'your.email@nature.com': 'votre.email@nature.com',
    'SYSTEM@DOMAIN.EXE': 'SYSTEME@DOMAINE.EXE',
    'CONFIGURE_ENDPOINT': 'CONFIGURER_ENDPOINT',
    'CONFIGURE WIRE ENDPOINT': 'CONFIGURER LE POINT FILAIRE',
    'CONFIGURE_ENDPOINT.EXE': 'CONFIGURER_ENDPOINT.EXE',
    'Enter your email...': 'Entrez votre e-mail...',
    'Enter your email for weekly updates...': 'Entrez votre e-mail pour les mises à jour hebdomadaires...'
  },
  de: {
    'Home': 'Startseite',
    'NO.': 'NR.',
    'Search Archive': 'Archiv durchsuchen',
    'Search posts, categories, or tags...': 'Beiträge, Kategorien oder Tags suchen...',
    'No matching posts found.': 'Keine passenden Beiträge gefunden.',
    'No posts published yet.': 'Noch keine Beiträge veröffentlicht.',
    '[ERROR: NO_POSTS_FOUND_IN_SECTOR]': '[FEHLER: KEINE_BEITRÄGE_IM_SEKTOR]',
    'NO ARTICLES REGISTERED IN ARCHIVES.': 'KEINE ARTIKEL IM ARCHIV REGISTRIERT.',
    'No publications found in the forest archives.': 'Keine Veröffentlichungen im Waldarchiv gefunden.',
    'NO STATIC DATA SECTORS DETECTED.': 'KEINE STATISCHEN DATENSEKTOREN ERKANNT.',
    'Read Entry →': 'Eintrag lesen →',
    'Explore Article →': 'Artikel ansehen →',
    '[ EXECUTE_POST_READER ]': '[ LESER_STARTEN ]',
    'READ FULL STORY →': 'GANZEN ARTIKEL LESEN →',
    'CONTINUE READING': 'WEITERLESEN',
    'LOAD ARTICLE_': 'ARTIKEL_LADEN_',
    '← Back to Musings': '← Zurück zu Gedanken',
    '← Back to Dashboard': '← Zurück zum Dashboard',
    '[ BACK_TO_DIRECTORY ]': '[ ZURÜCK_ZUM_VERZEICHNIS ]',
    '← BACK TO GAZETTE DIRECTORY': '← ZURÜCK ZUM GAZETTENVERZEICHNIS',
    '← BACK TO TREE HIERARCHY': '← ZURÜCK ZUR HIERARCHIE',
    'System Status: ONLINE': 'Systemstatus: ONLINE',
    'EDITION: DIGITAL AESTHETICS': 'AUSGABE: DIGITALE ÄSTHETIK',
    'Subscribe for the latest design & dev updates directly to your inbox.': 'Abonnieren Sie die neuesten Design- und Dev-Updates direkt per E-Mail.',
    'Subscribe for weekly drops of design, coding, and futuristic aesthetics.': 'Abonnieren Sie wöchentliche Updates zu Design, Code und futuristischer Ästhetik.',
    'CONNECT TO SECTOR NEWSLETTER STREAM.': 'MIT DEM SEKTOR-NEWSLETTER-STREAM VERBINDEN.',
    'Subscribe to our wire updates. Delivered instantly to your visual cortex.': 'Abonnieren Sie unsere Drahtmeldungen. Sofort an Ihren visuellen Cortex geliefert.',
    'Join the clearing. Receive our monthly letter on art, design, and mindful living.': 'Treten Sie der Lichtung bei. Erhalten Sie unseren Monatsbrief über Kunst, Design und achtsames Leben.',
    'Subscribe to transmit the latest digital aesthetic logs directly to your matrix terminal.': 'Abonnieren Sie die neuesten digitalen Ästhetik-Logs direkt an Ihr Matrix-Terminal.',
    'Your email address': 'Ihre E-Mail-Adresse',
    'Email address': 'E-Mail-Adresse',
    'Subscribe': 'Abonnieren',
    'SUBSCRIBE': 'ABONNIEREN',
    '[ INJECT ]': '[ INJIZIEREN ]',
    'JOIN LETTERS': 'BRIEFE ABONNIEREN',
    'TRANSMIT': 'ÜBERTRAGEN',
    'Configure newsletter endpoint': 'Newsletter-Endpunkt konfigurieren',
    'Configure': 'Konfigurieren',
    'CONFIGURE': 'KONFIGURIEREN',
    '[ CONFIG ]': '[ KONFIG ]',
    'CONFIG': 'KONFIG',
    'Email Address': 'E-Mail-Adresse',
    'Terminal Email Address': 'Terminal-E-Mail-Adresse',
    'Newsletter input': 'Newsletter-Eingabe',
    'E-mail for newsletter': 'E-Mail für Newsletter',
    'Neon Email Terminal': 'Neon-E-Mail-Terminal',
    'All rights reserved.': 'Alle Rechte vorbehalten.',
    'ALL RIGHTS SECURED.': 'ALLE RECHTE GESICHERT.',
    'UNCOMPROMISING DIGITAL DISPATCH.': 'KOMPROMISSLOSE DIGITALE DEPESCHE.',
    'SUSTAINED IN HARMONY WITH DIGITAL ECOSYSTEMS.': 'IM EINKLANG MIT DIGITALEN ÖKOSYSTEMEN GETRAGEN.',
    'ALL PROTOCOLS SECURED.': 'ALLE PROTOKOLLE GESICHERT.',
    'Powered by': 'Bereitgestellt von',
    'POWERED BY': 'BEREITGESTELLT VON',
    'COMPILED_BY:': 'KOMPILIERT_VON:',
    'DESIGNED ON': 'GESTALTET MIT',
    'SYSTEM_ENGINE:': 'SYSTEM_ENGINE:',
    'NAME:': 'NAME:',
    'About Me': 'Über mich',
    'Recent Posts': 'Neueste Beiträge',
    'Recent Musings': 'Neueste Gedanken',
    'Topics': 'Themen',
    'Newsletter': 'Newsletter',
    'Inner Circle Newsletter': 'Inner-Circle-Newsletter',
    'Custom HTML Block': 'Benutzerdefinierter HTML-Block',
    'admin@domain.com': 'admin@domain.de',
    'your.email@wire.com': 'deine.email@draht.de',
    'your.email@nature.com': 'deine.email@natur.de',
    'SYSTEM@DOMAIN.EXE': 'SYSTEM@DOMAIN.EXE',
    'CONFIGURE_ENDPOINT': 'ENDPUNKT_KONFIGURIEREN',
    'CONFIGURE WIRE ENDPOINT': 'DRAHT-ENDPUNKT KONFIGURIEREN',
    'CONFIGURE_ENDPOINT.EXE': 'ENDPUNKT_KONFIGURIEREN.EXE',
    'Enter your email...': 'E-Mail eingeben...',
    'Enter your email for weekly updates...': 'E-Mail für wöchentliche Updates eingeben...'
  },
  pt: {
    'Home': 'Início',
    'NO.': 'N.º',
    'Search Archive': 'Pesquisar no arquivo',
    'Search posts, categories, or tags...': 'Pesquisar posts, categorias ou tags...',
    'No matching posts found.': 'Nenhum post correspondente encontrado.',
    'No posts published yet.': 'Ainda não há posts publicados.',
    '[ERROR: NO_POSTS_FOUND_IN_SECTOR]': '[ERRO: NENHUM_POST_NO_SETOR]',
    'NO ARTICLES REGISTERED IN ARCHIVES.': 'NENHUM ARTIGO REGISTRADO NOS ARQUIVOS.',
    'No publications found in the forest archives.': 'Nenhuma publicação encontrada nos arquivos da floresta.',
    'NO STATIC DATA SECTORS DETECTED.': 'NENHUM SETOR DE DADOS ESTÁTICOS DETECTADO.',
    'Read Entry →': 'Ler entrada →',
    'Explore Article →': 'Explorar artigo →',
    '[ EXECUTE_POST_READER ]': '[ EXECUTAR_LEITOR ]',
    'READ FULL STORY →': 'LER HISTÓRIA COMPLETA →',
    'CONTINUE READING': 'CONTINUAR LENDO',
    'LOAD ARTICLE_': 'CARREGAR_ARTIGO_',
    '← Back to Musings': '← Voltar às reflexões',
    '← Back to Dashboard': '← Voltar ao painel',
    '[ BACK_TO_DIRECTORY ]': '[ VOLTAR_AO_DIRETÓRIO ]',
    '← BACK TO GAZETTE DIRECTORY': '← VOLTAR AO DIRETÓRIO DA GAZETA',
    '← BACK TO TREE HIERARCHY': '← VOLTAR À HIERARQUIA',
    'System Status: ONLINE': 'Status do sistema: ONLINE',
    'EDITION: DIGITAL AESTHETICS': 'EDIÇÃO: ESTÉTICA DIGITAL',
    'Subscribe for the latest design & dev updates directly to your inbox.': 'Assine para receber as últimas novidades de design e desenvolvimento no seu e-mail.',
    'Subscribe for weekly drops of design, coding, and futuristic aesthetics.': 'Assine envios semanais sobre design, código e estética futurista.',
    'CONNECT TO SECTOR NEWSLETTER STREAM.': 'CONECTAR AO FLUXO DE NEWSLETTER DO SETOR.',
    'Subscribe to our wire updates. Delivered instantly to your visual cortex.': 'Assine nossas atualizações. Entrega instantânea ao seu córtex visual.',
    'Join the clearing. Receive our monthly letter on art, design, and mindful living.': 'Junte-se à clareira. Receba nossa carta mensal sobre arte, design e vida consciente.',
    'Subscribe to transmit the latest digital aesthetic logs directly to your matrix terminal.': 'Assine para transmitir os logs de estética digital mais recentes ao seu terminal matriz.',
    'Your email address': 'Seu endereço de e-mail',
    'Email address': 'Endereço de e-mail',
    'Subscribe': 'Assinar',
    'SUBSCRIBE': 'ASSINAR',
    '[ INJECT ]': '[ INJETAR ]',
    'JOIN LETTERS': 'ASSINAR CARTAS',
    'TRANSMIT': 'TRANSMITIR',
    'Configure newsletter endpoint': 'Configure o endpoint da newsletter',
    'Configure': 'Configurar',
    'CONFIGURE': 'CONFIGURAR',
    '[ CONFIG ]': '[ CONFIGURAR ]',
    'CONFIG': 'CONFIGURAR',
    'Email Address': 'Endereço de e-mail',
    'Terminal Email Address': 'Endereço de e-mail do terminal',
    'Newsletter input': 'Campo da newsletter',
    'E-mail for newsletter': 'E-mail para newsletter',
    'Neon Email Terminal': 'Terminal de e-mail neon',
    'All rights reserved.': 'Todos os direitos reservados.',
    'ALL RIGHTS SECURED.': 'TODOS OS DIREITOS PROTEGIDOS.',
    'UNCOMPROMISING DIGITAL DISPATCH.': 'DESPACHO DIGITAL SEM CONCESSÕES.',
    'SUSTAINED IN HARMONY WITH DIGITAL ECOSYSTEMS.': 'SUSTENTADO EM HARMONIA COM ECOSSISTEMAS DIGITAIS.',
    'ALL PROTOCOLS SECURED.': 'TODOS OS PROTOCOLOS PROTEGIDOS.',
    'Powered by': 'Criado com',
    'POWERED BY': 'CRIADO COM',
    'COMPILED_BY:': 'COMPILADO_POR:',
    'DESIGNED ON': 'DESENHADO EM',
    'SYSTEM_ENGINE:': 'MOTOR_DO_SISTEMA:',
    'NAME:': 'NOME:',
    'About Me': 'Sobre mim',
    'Recent Posts': 'Posts recentes',
    'Recent Musings': 'Reflexões recentes',
    'Topics': 'Tópicos',
    'Newsletter': 'Newsletter',
    'Inner Circle Newsletter': 'Newsletter do círculo interno',
    'Custom HTML Block': 'Bloco HTML personalizado',
    'admin@domain.com': 'admin@dominio.com',
    'your.email@wire.com': 'seu.email@fio.com',
    'your.email@nature.com': 'seu.email@natureza.com',
    'SYSTEM@DOMAIN.EXE': 'SISTEMA@DOMINIO.EXE',
    'CONFIGURE_ENDPOINT': 'CONFIGURAR_ENDPOINT',
    'CONFIGURE WIRE ENDPOINT': 'CONFIGURAR ENDPOINT',
    'CONFIGURE_ENDPOINT.EXE': 'CONFIGURAR_ENDPOINT.EXE',
    'Enter your email...': 'Digite seu e-mail...',
    'Enter your email for weekly updates...': 'Digite seu e-mail para atualizações semanais...'
  }
};

// Middleware configurations
app.use(cors({
  origin(origin, callback) {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Setup folder paths
const CONTENT_DIR = path.join(__dirname, 'content');
const POSTS_DIR = path.join(CONTENT_DIR, 'posts');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const OUT_DIR = path.join(__dirname, 'out');
const PUBLIC_DIR = path.join(__dirname, 'public');
const COMMON_SEARCH_SCRIPT = path.join(TEMPLATES_DIR, 'search.js');
const COMMON_SEARCH_STYLE = path.join(TEMPLATES_DIR, 'search.css');
const FAVICON_SOURCE = path.join(PUBLIC_DIR, 'favicon.svg');

// Ensure necessary directories exist on startup
[CONTENT_DIR, POSTS_DIR, IMAGES_DIR, OUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve frontend assets and public content with cache disabling to prevent browser cache traps during testing
const serveNoCache = (dir) => express.static(dir, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
});

app.use(serveNoCache(path.join(__dirname, 'out'))); // Compiled static public site at root
app.use('/admin', serveNoCache(path.join(__dirname, 'dist'))); // Admin dashboard SPA at /admin
app.use('/content/images', serveNoCache(IMAGES_DIR)); // Decoded images
app.get(['/favicon.svg', '/favicon.ico'], (req, res) => {
  if (!fs.existsSync(FAVICON_SOURCE)) {
    res.status(404).end();
    return;
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.type('image/svg+xml');
  res.sendFile(FAVICON_SOURCE);
});



// Setup initial settings if not present
const SETTINGS_FILE = path.join(CONTENT_DIR, 'settings.json');
if (!fs.existsSync(SETTINGS_FILE)) {
  const defaultSettings = {
    siteName: "Zenith Press",
    siteSubtitle: "Explorations in Design, Art & Technology",
    authorName: "Aara Dev",
    authorBio: "Designer and coder.",
    authorAvatar: "",
    siteUrl: process.env.PUBLIC_SITE_URL || "",
    seoDescription: "",
    seoKeywords: "",
    seoImage: "",
    allowIndexing: true,
    socialLinks: { github: "", twitter: "", linkedin: "", instagram: "" },
    selectedTemplate: "nordic-minimal",
    locale: DEFAULT_LOCALE,
    themeText: normalizeThemeText(),
    widgets: [
      { id: "bio", name: "About Me", type: "bio", enabled: true, position: "sidebar", order: 1 },
      { id: "recent-posts", name: "Recent Posts", type: "recent-posts", enabled: true, position: "sidebar", order: 2 },
      { id: "tag-cloud", name: "Topics", type: "tag-cloud", enabled: true, position: "sidebar", order: 3 },
      {
        id: "newsletter",
        name: "Newsletter",
        type: "newsletter",
        enabled: true,
        position: "footer",
        order: 4,
        placeholderText: "Enter your email...",
        actionUrl: ""
      }
    ]
  };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), 'utf-8');
}

// ----------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------

// Calculate reading time
function calculateReadingTime(text) {
  const wordsPerMinute = 200;
  const numberOfWords = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(numberOfWords / wordsPerMinute);
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel']
  });
}

function renderMarkdown(markdown) {
  return sanitizeHtml(marked.parse(String(markdown || '')));
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function isValidSlug(slug) {
  return SAFE_SLUG_RE.test(String(slug || ''));
}

function assertValidSlug(slug) {
  if (!isValidSlug(slug)) {
    const err = new Error('Slug must use lowercase letters, numbers, and single hyphens only.');
    err.statusCode = 400;
    throw err;
  }
}

function resolveInside(baseDir, ...segments) {
  const basePath = path.resolve(baseDir);
  const targetPath = path.resolve(basePath, ...segments);
  if (targetPath !== basePath && !targetPath.startsWith(`${basePath}${path.sep}`)) {
    const err = new Error('Resolved path escaped the allowed directory.');
    err.statusCode = 400;
    throw err;
  }
  return targetPath;
}

function postFilePath(slug) {
  assertValidSlug(slug);
  return resolveInside(POSTS_DIR, `${slug}.md`);
}

function postOutputDir(slug) {
  assertValidSlug(slug);
  return resolveInside(path.join(OUT_DIR, 'posts'), slug);
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(tag => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(tag => tag.trim()).filter(Boolean);
  }
  return [];
}

function normalizeActionUrl(actionUrl) {
  const value = String(actionUrl || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? value : '';
  } catch {
    return '';
  }
}

function normalizePublicUrl(value, options = {}) {
  const urlValue = String(value || '').trim();
  if (!urlValue) return '';
  if (options.allowRelative && urlValue.startsWith('/') && !urlValue.startsWith('//')) {
    return urlValue.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 500);
  }
  try {
    const url = new URL(urlValue);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    if (options.dropSearch !== false) url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function normalizeKeywordList(value) {
  const keywords = Array.isArray(value) ? value : String(value || '').split(',');
  return keywords
    .map(keyword => String(keyword).trim())
    .filter(Boolean)
    .slice(0, 24)
    .join(', ');
}

function hasDynamicVariable(value) {
  return /\{[A-Za-z][A-Za-z0-9_]*\}/.test(String(value || ''));
}

function normalizeThemeTextUrl(value, options = {}) {
  const urlValue = String(value || '').trim();
  if (!urlValue) return '';
  if (options.allowVariables && hasDynamicVariable(urlValue)) {
    return urlValue.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 180);
  }
  if (urlValue === '#' || (urlValue.startsWith('/') && !urlValue.startsWith('//'))) {
    return urlValue;
  }
  try {
    const url = new URL(urlValue);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? urlValue : '';
  } catch {
    return '';
  }
}

function normalizeThemeTextValue(key, value) {
  if (key === 'footerCreditUrl') return normalizeThemeTextUrl(value, { allowVariables: true });
  const limit = LONG_THEME_TEXT_KEYS.has(key) ? 500 : 180;
  return String(value || '').replace(/\0/g, '').slice(0, limit);
}

function normalizeThemeText(themeText = {}) {
  const source = themeText && typeof themeText === 'object' ? themeText : {};
  return THEME_TEXT_KEYS.reduce((acc, key) => {
    acc[key] = normalizeThemeTextValue(key, source[key]);
    return acc;
  }, {});
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveTemplateVariables(value, variables = {}, options = {}) {
  return String(value || '').replace(DYNAMIC_VARIABLE_RE, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) {
      return match;
    }
    const replacement = String(variables[key] ?? '');
    return options.escapeValues ? escapeHtml(replacement) : replacement;
  });
}

function postUrl(post) {
  return post?.slug ? `/posts/${post.slug}/index.html` : '';
}

function formatPostTags(post) {
  return normalizeTags(post?.tags).join(', ');
}

function normalizeLocale(locale) {
  const value = String(locale || DEFAULT_LOCALE)
    .trim()
    .toLowerCase()
    .replace('_', '-');
  const baseLocale = value.split('-')[0];
  return Object.prototype.hasOwnProperty.call(SUPPORTED_LOCALES, baseLocale)
    ? baseLocale
    : DEFAULT_LOCALE;
}

function translateText(value, locale) {
  const text = String(value || '');
  const normalizedLocale = normalizeLocale(locale);
  if (normalizedLocale === DEFAULT_LOCALE) return text;
  return TRANSLATIONS[normalizedLocale]?.[text] || text;
}

function parseDateValue(value) {
  if (value instanceof Date) return value;
  const text = String(value || '').trim();
  if (!text) return null;
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateForLocale(value, locale, options = { dateStyle: 'medium' }) {
  const date = parseDateValue(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(normalizeLocale(locale), options).format(date);
}

function toIsoDate(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  return date.toISOString();
}

function toIsoDateOnly(value) {
  const iso = toIsoDate(value);
  return iso ? iso.split('T')[0] : '';
}

function htmlToText(html) {
  const fragment = window.document.createElement('div');
  fragment.innerHTML = String(html || '');
  return (fragment.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…`;
}

function getBasePath(settings) {
  if (!settings.siteUrl) return '';
  try {
    const url = new URL(settings.siteUrl);
    return url.pathname.replace(/\/$/, '');
  } catch {
    return '';
  }
}

function sitePath(settings, pathname = '/') {
  const rawPath = String(pathname || '/');
  const relative = new URL(rawPath, 'https://local.test');
  const basePath = getBasePath(settings);
  const cleanPath = relative.pathname === '/' ? '/' : `/${relative.pathname.replace(/^\/+/, '')}`;
  const joinedPath = `${basePath}${cleanPath}`.replace(/\/{2,}/g, '/');
  return `${joinedPath || '/'}${relative.search}${relative.hash}`;
}

function absoluteUrl(settings, pathname = '/') {
  if (!settings.siteUrl) return '';
  try {
    const base = new URL(settings.siteUrl);
    base.pathname = sitePath(settings, pathname).split(/[?#]/)[0];
    const relative = new URL(String(pathname || '/'), 'https://local.test');
    base.search = relative.search;
    base.hash = relative.hash;
    return base.toString();
  } catch {
    return '';
  }
}

function assetUrl(settings, urlValue) {
  const value = String(urlValue || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return absoluteUrl(settings, value) || value;
}

function pagePathForPost(post) {
  return post?.slug ? `/posts/${post.slug}/` : '/';
}

function markdownPathForPost(post) {
  return post?.slug ? `/posts/${post.slug}/index.html.md` : '/index.html.md';
}

function ogLocale(locale) {
  const map = {
    en: 'en_US',
    es: 'es_ES',
    fr: 'fr_FR',
    de: 'de_DE',
    pt: 'pt_PT'
  };
  return map[normalizeLocale(locale)] || 'en_US';
}

function jsonLdScript(data) {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
}

function mergeKeywords(...sources) {
  const seen = new Set();
  const keywords = [];
  sources.flatMap(source => normalizeTags(source)).forEach(keyword => {
    const normalized = keyword.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      keywords.push(keyword);
    }
  });
  return keywords;
}

function createPersonSchema(settings) {
  const sameAs = [
    settings.socialLinks.github,
    settings.socialLinks.twitter,
    settings.socialLinks.linkedin,
    settings.socialLinks.instagram
  ].filter(Boolean);
  return {
    '@type': 'Person',
    '@id': absoluteUrl(settings, '/#author') || '#author',
    name: settings.authorName || settings.siteName,
    ...(settings.authorBio ? { description: settings.authorBio } : {}),
    ...(settings.authorAvatar ? { image: assetUrl(settings, settings.authorAvatar) } : {}),
    ...(sameAs.length ? { sameAs } : {})
  };
}

function createPublisherSchema(settings) {
  return {
    '@type': 'Organization',
    '@id': absoluteUrl(settings, '/#publisher') || '#publisher',
    name: settings.siteName,
    url: absoluteUrl(settings, '/') || settings.siteUrl || '/',
    ...(settings.seoImage || settings.authorAvatar ? {
      logo: {
        '@type': 'ImageObject',
        url: assetUrl(settings, settings.seoImage || settings.authorAvatar)
      }
    } : {})
  };
}

function createHomePageMeta(settings, homepageText, posts) {
  const description = truncateText(settings.seoDescription || homepageText.siteSubtitle || homepageText.authorBio, 180);
  const titleSuffix = homepageText.siteSubtitle ? homepageText.siteSubtitle : translateText('Home', settings.locale);
  const title = `${homepageText.siteName} | ${titleSuffix}`;
  const url = absoluteUrl(settings, '/');
  const image = assetUrl(settings, settings.seoImage || settings.authorAvatar);
  const keywords = mergeKeywords(settings.seoKeywords, posts.flatMap(post => [post.category, ...(post.tags || [])]));
  const graph = [
    createPublisherSchema(settings),
    createPersonSchema(settings),
    {
      '@type': 'WebSite',
      '@id': absoluteUrl(settings, '/#website') || '#website',
      name: homepageText.siteName,
      url: url || '/',
      inLanguage: settings.locale,
      description,
      publisher: { '@id': absoluteUrl(settings, '/#publisher') || '#publisher' },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${url || '/'}?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    },
    {
      '@type': 'Blog',
      '@id': absoluteUrl(settings, '/#blog') || '#blog',
      name: homepageText.siteName,
      url: url || '/',
      inLanguage: settings.locale,
      description,
      author: { '@id': absoluteUrl(settings, '/#author') || '#author' },
      publisher: { '@id': absoluteUrl(settings, '/#publisher') || '#publisher' },
      blogPost: posts.map(post => ({
        '@type': 'BlogPosting',
        '@id': `${absoluteUrl(settings, pagePathForPost(post)) || pagePathForPost(post)}#blogposting`,
        headline: post.title,
        url: absoluteUrl(settings, pagePathForPost(post)) || pagePathForPost(post),
        datePublished: toIsoDate(post.date),
        dateModified: post.modifiedAt || toIsoDate(post.date)
      }))
    }
  ];

  return {
    type: 'website',
    title,
    description,
    canonicalUrl: url,
    markdownUrl: absoluteUrl(settings, '/index.html.md') || '/index.html.md',
    image,
    keywords,
    robots: settings.allowIndexing ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
    locale: ogLocale(settings.locale),
    jsonLd: { '@context': 'https://schema.org', '@graph': graph }
  };
}

function createPostPageMeta(settings, homepageText, post) {
  const description = truncateText(post.description || post.plainText, 180);
  const url = absoluteUrl(settings, pagePathForPost(post));
  const image = assetUrl(settings, post.coverImage || settings.seoImage || settings.authorAvatar);
  const keywords = mergeKeywords(settings.seoKeywords, post.category, post.tags);
  const authorId = absoluteUrl(settings, '/#author') || '#author';
  const publisherId = absoluteUrl(settings, '/#publisher') || '#publisher';
  const postId = `${url || pagePathForPost(post)}#blogposting`;
  const graph = [
    createPublisherSchema(settings),
    createPersonSchema(settings),
    {
      '@type': 'BreadcrumbList',
      '@id': `${url || pagePathForPost(post)}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: homepageText.siteName,
          item: absoluteUrl(settings, '/') || '/'
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: post.title,
          item: url || pagePathForPost(post)
        }
      ]
    },
    {
      '@type': 'BlogPosting',
      '@id': postId,
      mainEntityOfPage: url || pagePathForPost(post),
      url: url || pagePathForPost(post),
      headline: post.title,
      name: post.title,
      description,
      inLanguage: settings.locale,
      datePublished: toIsoDate(post.date),
      dateModified: post.modifiedAt || toIsoDate(post.date),
      author: { '@id': authorId },
      publisher: { '@id': publisherId },
      isPartOf: { '@id': absoluteUrl(settings, '/#blog') || '#blog' },
      ...(image ? { image } : {}),
      ...(post.category ? { articleSection: post.category } : {}),
      ...(keywords.length ? { keywords } : {}),
      ...(post.readingTime ? { timeRequired: `PT${post.readingTime}M` } : {}),
      ...(post.wordCount ? { wordCount: post.wordCount } : {})
    }
  ];

  return {
    type: 'article',
    title: `${post.title} | ${homepageText.siteName}`,
    description,
    canonicalUrl: url,
    markdownUrl: absoluteUrl(settings, markdownPathForPost(post)) || markdownPathForPost(post),
    image,
    keywords,
    robots: settings.allowIndexing ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
    locale: ogLocale(settings.locale),
    publishedTime: toIsoDate(post.date),
    modifiedTime: post.modifiedAt || toIsoDate(post.date),
    section: post.category,
    tags: post.tags || [],
    author: settings.authorName,
    jsonLd: { '@context': 'https://schema.org', '@graph': graph }
  };
}

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function markdownEscape(value) {
  return String(value || '').replace(/\]/g, '\\]');
}

function createSitemapXml(settings, posts, generatedAt) {
  const homeUrl = absoluteUrl(settings, '/');
  if (!homeUrl) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
  }

  const urls = [
    {
      loc: homeUrl,
      lastmod: toIsoDateOnly(generatedAt),
      changefreq: 'weekly',
      priority: '1.0'
    },
    ...posts.map(post => ({
      loc: absoluteUrl(settings, pagePathForPost(post)),
      lastmod: toIsoDateOnly(post.modifiedAt || post.date),
      changefreq: 'monthly',
      priority: '0.8'
    }))
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.filter(url => url.loc).map(url => [
      '  <url>',
      `    <loc>${xmlEscape(url.loc)}</loc>`,
      `    <lastmod>${xmlEscape(url.lastmod)}</lastmod>`,
      `    <changefreq>${xmlEscape(url.changefreq)}</changefreq>`,
      `    <priority>${xmlEscape(url.priority)}</priority>`,
      '  </url>'
    ].join('\n')),
    '</urlset>',
    ''
  ].join('\n');
}

function createRobotsTxt(settings) {
  const sitemapUrl = absoluteUrl(settings, '/sitemap.xml');
  const llmsUrl = absoluteUrl(settings, '/llms.txt');
  return [
    'User-agent: *',
    settings.allowIndexing ? 'Allow: /' : 'Disallow: /',
    sitemapUrl ? `Sitemap: ${sitemapUrl}` : 'Sitemap: /sitemap.xml',
    llmsUrl ? `# LLM guide: ${llmsUrl}` : '# LLM guide: /llms.txt',
    ''
  ].join('\n');
}

function createHomeMarkdown(settings, homepageText, posts) {
  const postLines = posts.map(post => (
    `- [${markdownEscape(post.title)}](${absoluteUrl(settings, pagePathForPost(post)) || pagePathForPost(post)}): ${post.description || post.category || 'Blog post'}`
  ));
  return [
    `# ${homepageText.siteName}`,
    '',
    `> ${settings.seoDescription || homepageText.siteSubtitle || 'Static blog archive.'}`,
    '',
    `Author: ${homepageText.authorName}`,
    `Language: ${SUPPORTED_LOCALES[settings.locale]} (${settings.locale})`,
    '',
    '## Posts',
    ...(postLines.length ? postLines : ['No published posts.']),
    ''
  ].join('\n');
}

function createPostMarkdown(settings, homepageText, post) {
  return [
    `# ${post.title}`,
    '',
    `> ${post.description || 'Blog post.'}`,
    '',
    `Canonical URL: ${absoluteUrl(settings, pagePathForPost(post)) || pagePathForPost(post)}`,
    `Published: ${toIsoDateOnly(post.date)}`,
    `Modified: ${toIsoDateOnly(post.modifiedAt || post.date)}`,
    `Author: ${homepageText.authorName}`,
    `Category: ${post.category}`,
    `Tags: ${(post.tags || []).join(', ') || 'None'}`,
    '',
    post.rawContent || '',
    ''
  ].join('\n');
}

function createLlmsTxt(settings, homepageText, posts) {
  const postLines = posts.map(post => {
    const markdownUrl = absoluteUrl(settings, markdownPathForPost(post)) || markdownPathForPost(post);
    return `- [${markdownEscape(post.title)}](${markdownUrl}): ${post.description || `${post.category} post`}`;
  });
  const optional = [
    `- [Sitemap](${absoluteUrl(settings, '/sitemap.xml') || '/sitemap.xml'}): XML list of canonical public URLs`,
    `- [Search index](${absoluteUrl(settings, '/search.json') || '/search.json'}): Machine-readable post metadata used by the public search UI`,
    `- [Full LLM context](${absoluteUrl(settings, '/llms-full.txt') || '/llms-full.txt'}): Plain Markdown bundle of the public archive`
  ];

  return [
    `# ${homepageText.siteName}`,
    '',
    `> ${settings.seoDescription || homepageText.siteSubtitle || 'Static blog archive.'}`,
    '',
    `This site is a static blog generated by ZenithPress. Post bodies are canonical as authored Markdown; interface text may be localized with the website locale setting.`,
    `Language: ${SUPPORTED_LOCALES[settings.locale]} (${settings.locale}).`,
    '',
    '## Canonical Site',
    `- [Home](${absoluteUrl(settings, '/') || '/'}): ${homepageText.siteSubtitle || 'Public blog homepage'}`,
    '',
    '## Posts',
    ...(postLines.length ? postLines : ['No published posts.']),
    '',
    '## Optional',
    ...optional,
    ''
  ].join('\n');
}

function createLlmsFullTxt(settings, homepageText, posts) {
  return [
    createLlmsTxt(settings, homepageText, posts),
    '---',
    '',
    ...posts.flatMap(post => [
      createPostMarkdown(settings, homepageText, post),
      '---',
      ''
    ])
  ].join('\n');
}

function createDynamicVariables(settings, posts = [], currentPost = null, now = new Date()) {
  const latestPost = posts[0] || null;
  const currentUrl = postUrl(currentPost);
  const latestUrl = postUrl(latestPost);
  const locale = normalizeLocale(settings.locale);
  const date = formatDateForLocale(now, locale, { dateStyle: 'long' });
  const time = formatDateForLocale(now, locale, { timeStyle: 'short' });
  const month = formatDateForLocale(now, locale, { month: 'long' });
  const day = formatDateForLocale(now, locale, { day: '2-digit' });

  return {
    date,
    time,
    generatedAt: `${date} ${time}`,
    isoDate: now.toISOString().split('T')[0],
    year: String(now.getFullYear()),
    month,
    day,
    siteName: settings.siteName,
    siteSubtitle: settings.siteSubtitle,
    authorName: settings.authorName,
    authorBio: settings.authorBio,
    locale,
    language: SUPPORTED_LOCALES[locale],
    template: settings.selectedTemplate,
    homeUrl: '/index.html',
    postCount: String(posts.length),
    lastPost: latestUrl,
    lastPostUrl: latestUrl,
    lastPostSlug: latestPost?.slug || '',
    lastPostTitle: latestPost?.title || '',
    lastPostDescription: latestPost?.description || '',
    lastPostDate: latestPost ? formatDateForLocale(latestPost.date, locale) : '',
    lastPostIsoDate: latestPost?.date || '',
    lastPostCategory: latestPost?.category || '',
    lastPostTags: formatPostTags(latestPost),
    lastPostReadingTime: latestPost?.readingTime ? String(latestPost.readingTime) : '',
    latestPost: latestUrl,
    latestPostUrl: latestUrl,
    latestPostTitle: latestPost?.title || '',
    post: currentUrl,
    postUrl: currentUrl,
    postSlug: currentPost?.slug || '',
    postTitle: currentPost?.title || '',
    postDescription: currentPost?.description || '',
    postDate: currentPost ? formatDateForLocale(currentPost.date, locale) : '',
    postIsoDate: currentPost?.date || '',
    postCategory: currentPost?.category || '',
    postTags: formatPostTags(currentPost),
    postReadingTime: currentPost?.readingTime ? String(currentPost.readingTime) : ''
  };
}

function resolveThemeTextCopy(settings, key, fallback = '', variables = {}) {
  const value = settings.themeText?.[key];
  const rawValue = typeof value === 'string' && value.trim()
    ? value
    : translateText(fallback, settings.locale);
  const resolved = resolveTemplateVariables(rawValue, variables);
  if (key === 'footerCreditUrl') {
    return normalizeThemeTextUrl(resolved) || normalizeThemeTextUrl(fallback) || '#';
  }
  return resolved;
}

function resolveSettingsText(settings, variables) {
  return {
    siteName: resolveTemplateVariables(settings.siteName, variables),
    siteSubtitle: resolveTemplateVariables(settings.siteSubtitle, variables),
    authorName: resolveTemplateVariables(settings.authorName, variables),
    authorBio: resolveTemplateVariables(settings.authorBio, variables)
  };
}

function resolveWidgets(widgets, variables, locale) {
  return widgets.map(widget => ({
    ...widget,
    name: resolveTemplateVariables(translateText(widget.name, locale), variables),
    placeholderText: resolveTemplateVariables(translateText(widget.placeholderText, locale), variables),
    htmlContent: resolveTemplateVariables(widget.htmlContent, variables, { escapeValues: true })
  }));
}

function metaTag(name, content) {
  return content ? `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}">` : '';
}

function propertyTag(property, content) {
  return content ? `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}">` : '';
}

function renderSeoHead(pageMeta = {}) {
  const tags = [
    `<title>${escapeHtml(pageMeta.title || '')}</title>`,
    metaTag('description', pageMeta.description),
    metaTag('robots', pageMeta.robots),
    metaTag('generator', 'ZenithPress'),
    metaTag('keywords', (pageMeta.keywords || []).join(', ')),
    pageMeta.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(pageMeta.canonicalUrl)}">` : '',
    pageMeta.markdownUrl ? `<link rel="alternate" type="text/markdown" href="${escapeHtml(pageMeta.markdownUrl)}">` : '',
    propertyTag('og:type', pageMeta.type === 'article' ? 'article' : 'website'),
    propertyTag('og:title', pageMeta.title),
    propertyTag('og:description', pageMeta.description),
    propertyTag('og:url', pageMeta.canonicalUrl),
    propertyTag('og:site_name', pageMeta.siteName),
    propertyTag('og:locale', pageMeta.locale),
    propertyTag('og:image', pageMeta.image),
    metaTag('twitter:card', pageMeta.image ? 'summary_large_image' : 'summary'),
    metaTag('twitter:title', pageMeta.title),
    metaTag('twitter:description', pageMeta.description),
    metaTag('twitter:image', pageMeta.image),
    pageMeta.type === 'article' ? propertyTag('article:published_time', pageMeta.publishedTime) : '',
    pageMeta.type === 'article' ? propertyTag('article:modified_time', pageMeta.modifiedTime) : '',
    pageMeta.type === 'article' ? propertyTag('article:author', pageMeta.author) : '',
    pageMeta.type === 'article' ? propertyTag('article:section', pageMeta.section) : '',
    ...(pageMeta.type === 'article' ? (pageMeta.tags || []).map(tag => propertyTag('article:tag', tag)) : []),
    pageMeta.jsonLd ? `<script type="application/ld+json">${jsonLdScript(pageMeta.jsonLd)}</script>` : ''
  ];
  return tags.filter(Boolean).join('\n  ');
}

function createTemplateHelpers(settings, variables) {
  return {
    upper: value => String(value || '').toUpperCase(),
    t: value => resolveTemplateVariables(translateText(value, settings.locale), variables),
    copy: (key, fallback = '') => resolveThemeTextCopy(settings, key, fallback, variables),
    date: value => formatDateForLocale(value, settings.locale),
    isoDate: value => toIsoDate(value),
    seoHead: pageMeta => renderSeoHead({ ...pageMeta, siteName: settings.siteName }),
    longDate: value => formatDateForLocale(value, settings.locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };
}

function assertTemplateContext(data, templateLabel, options = {}) {
  const requiredFields = options.requirePost
    ? [...REQUIRED_TEMPLATE_FIELDS, 'post']
    : REQUIRED_TEMPLATE_FIELDS;
  const missingFields = requiredFields.filter(field => data[field] === undefined);
  if (missingFields.length) {
    throw new Error(`${templateLabel} render context missing required fields: ${missingFields.join(', ')}`);
  }

  if (!data.pageMeta || typeof data.pageMeta !== 'object') {
    throw new Error(`${templateLabel} render context requires pageMeta to be an object.`);
  }

  const missingHelpers = REQUIRED_TEMPLATE_HELPERS.filter(helperName => typeof data.helpers?.[helperName] !== 'function');
  if (missingHelpers.length) {
    throw new Error(`${templateLabel} render context missing helper functions: ${missingHelpers.join(', ')}`);
  }
}

function renderTemplate(template, data, templateLabel, options) {
  assertTemplateContext(data, templateLabel, options);
  return ejs.render(template, data);
}

function normalizeWidget(widget = {}) {
  return {
    ...widget,
    id: String(widget.id || `${widget.type || 'widget'}-${Date.now()}`),
    name: String(widget.name || widget.type || 'Widget'),
    type: String(widget.type || 'custom-html'),
    enabled: widget.enabled !== false,
    position: widget.position === 'footer' ? 'footer' : 'sidebar',
    order: Number.isFinite(Number(widget.order)) ? Number(widget.order) : 99,
    placeholderText: widget.placeholderText || '',
    actionUrl: normalizeActionUrl(widget.actionUrl),
    htmlContent: widget.htmlContent || ''
  };
}

function normalizeSettings(settings = {}) {
  return {
    siteName: String(settings.siteName || 'Zenith Press'),
    siteSubtitle: String(settings.siteSubtitle || ''),
    authorName: String(settings.authorName || ''),
    authorBio: String(settings.authorBio || ''),
    authorAvatar: String(settings.authorAvatar || ''),
    siteUrl: normalizePublicUrl(settings.siteUrl || process.env.PUBLIC_SITE_URL || ''),
    seoDescription: String(settings.seoDescription || '').replace(/\0/g, '').slice(0, 320),
    seoKeywords: normalizeKeywordList(settings.seoKeywords),
    seoImage: normalizePublicUrl(settings.seoImage, { allowRelative: true }),
    allowIndexing: settings.allowIndexing !== false,
    socialLinks: {
      github: settings.socialLinks?.github || '',
      twitter: settings.socialLinks?.twitter || '',
      linkedin: settings.socialLinks?.linkedin || '',
      instagram: settings.socialLinks?.instagram || ''
    },
    selectedTemplate: String(settings.selectedTemplate || 'nordic-minimal'),
    locale: normalizeLocale(settings.locale),
    themeText: normalizeThemeText(settings.themeText),
    widgets: Array.isArray(settings.widgets) ? settings.widgets.map(normalizeWidget) : []
  };
}

function readSettings() {
  return normalizeSettings(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')));
}

function normalizePost(attributes = {}, body = '', fileName = '') {
  const fileSlug = slugify(path.basename(fileName, path.extname(fileName)));
  const title = String(attributes.title || 'Untitled Post');
  const slug = slugify(attributes.slug || fileSlug || title);
  return {
    title,
    slug: isValidSlug(slug) ? slug : fileSlug || slugify(title) || 'untitled-post',
    description: String(attributes.description || ''),
    date: String(attributes.date || new Date().toISOString().split('T')[0]),
    category: String(attributes.category || 'Uncategorized'),
    tags: normalizeTags(attributes.tags),
    coverImage: String(attributes.coverImage || ''),
    draft: attributes.draft === true,
    content: String(body || ''),
    readingTime: calculateReadingTime(body),
    wordCount: countWords(body),
    fileName
  };
}

function normalizePostPayload(body = {}) {
  const title = String(body.title || '').trim();
  const slug = String(body.slug || '').trim();
  if (!title || !slug) {
    const err = new Error('Title and Slug are required.');
    err.statusCode = 400;
    throw err;
  }
  assertValidSlug(slug);
  return {
    title,
    slug,
    description: String(body.description || ''),
    date: String(body.date || new Date().toISOString().split('T')[0]),
    category: String(body.category || 'Uncategorized'),
    tags: normalizeTags(body.tags),
    coverImage: String(body.coverImage || ''),
    content: String(body.content || ''),
    draft: body.draft === true
  };
}

function serializePostMarkdown(post) {
  return [
    '---',
    `title: ${JSON.stringify(post.title)}`,
    `slug: ${JSON.stringify(post.slug)}`,
    `description: ${JSON.stringify(post.description)}`,
    `date: ${JSON.stringify(post.date)}`,
    `category: ${JSON.stringify(post.category)}`,
    `tags: ${JSON.stringify(post.tags)}`,
    `coverImage: ${JSON.stringify(post.coverImage)}`,
    `draft: ${post.draft === true}`,
    '---',
    '',
    post.content
  ].join('\n');
}

// Read and parse all posts
function getAllPosts(includeDrafts = true) {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR);
  const posts = files
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const filePath = path.join(POSTS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);
      const parsed = fm(content);
      
      return {
        ...normalizePost(parsed.attributes, parsed.body, file),
        modifiedAt: stats.mtime.toISOString()
      };
    });

  // Sort by date descending
  return posts
    .filter(post => includeDrafts || !post.draft)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function runCommand(command, args = [], cwd = __dirname) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (session.expiresAt <= now) {
      sessionStore.delete(token);
    }
  }
}

function createSessionToken() {
  cleanupExpiredSessions();
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessionStore.set(token, { expiresAt });
  return { token, expiresAt };
}

function requireAuth(req, res, next) {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const session = sessionStore.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessionStore.delete(token);
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  next();
}

function validateRemoteUrl(remoteUrl) {
  const value = String(remoteUrl || '').trim();
  const githubSsh = /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/;
  const githubHttps = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/;
  if (!githubSsh.test(value) && !githubHttps.test(value)) {
    const err = new Error('Remote URL must be a GitHub SSH or HTTPS repository URL.');
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function validateBranch(branch) {
  const value = String(branch || 'gh-pages').trim();
  if (!SAFE_BRANCH_RE.test(value) || value.endsWith('.lock')) {
    const err = new Error('Branch name contains unsupported characters.');
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function validateCommitMessage(message) {
  const value = String(message || 'Publish: Static Pages Deploy').trim();
  if (!value || value.length > 160 || /[\r\n\0]/.test(value)) {
    const err = new Error('Commit message must be 1-160 characters without control characters.');
    err.statusCode = 400;
    throw err;
  }
  return value;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Authentication endpoint
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const { token, expiresAt } = createSessionToken();
    res.json({ success: true, token, expiresAt });
  } else {
    res.status(401).json({ success: false, message: 'Invalid administrative credential password.' });
  }
});

app.use('/api', requireAuth);

// Fetch settings
app.get('/api/settings', (req, res) => {
  try {
    res.json(readSettings());
  } catch (err) {
    res.status(500).json({ error: 'Failed to read settings configuration.' });
  }
});

// Update settings
app.post('/api/settings', (req, res) => {
  try {
    const settings = normalizeSettings(req.body);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write settings configuration.' });
  }
});

// Fetch all posts (for admin view)
app.get('/api/posts', (req, res) => {
  try {
    const posts = getAllPosts(true);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts.' });
  }
});

// Fetch a single post
app.get('/api/posts/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const filePath = postFilePath(slug);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = fm(content);
    const post = normalizePost(parsed.attributes, parsed.body, `${slug}.md`);
    res.json({
      meta: { ...post, content: undefined },
      content: post.content
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to fetch post.' });
  }
});

// Create new post
app.post('/api/posts', (req, res) => {
  try {
    const post = normalizePostPayload(req.body);
    const filePath = postFilePath(post.slug);
    if (fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'A post with this slug already exists.' });
    }

    fs.writeFileSync(filePath, serializePostMarkdown(post), 'utf-8');
    res.json({ success: true, message: 'Post created successfully.' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to create post.' });
  }
});

// Update post
app.put('/api/posts/:slug', (req, res) => {
  try {
    const oldSlug = req.params.slug;
    assertValidSlug(oldSlug);
    const post = normalizePostPayload(req.body);
    const oldFilePath = postFilePath(oldSlug);
    const newFilePath = postFilePath(post.slug);

    if (!fs.existsSync(oldFilePath)) {
      return res.status(404).json({ error: 'Original post not found.' });
    }

    // Handle slug change
    if (oldSlug !== post.slug && fs.existsSync(newFilePath)) {
      return res.status(400).json({ error: 'A post with the new slug already exists.' });
    }

    // If slug changed, delete the old file
    if (oldSlug !== post.slug) {
      fs.unlinkSync(oldFilePath);
    }

    fs.writeFileSync(newFilePath, serializePostMarkdown(post), 'utf-8');
    res.json({ success: true, message: 'Post updated successfully.' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to update post.' });
  }
});

// Delete post
app.delete('/api/posts/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const filePath = postFilePath(slug);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to delete post.' });
  }
});

// Base64 Image Upload
app.post('/api/images/upload', (req, res) => {
  try {
    const { filename, base64Data } = req.body;
    if (!filename || !base64Data) {
      return res.status(400).json({ error: 'Missing filename or image data.' });
    }

    const cleanBase64 = String(base64Data).replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Save locally
    const ext = path.extname(filename).toLowerCase() || '.jpg';
    if (!SAFE_IMAGE_EXTENSIONS.has(ext)) {
      return res.status(400).json({ error: 'Unsupported image file type.' });
    }
    const uniqueName = `image_${Date.now()}${ext}`;
    const targetPath = resolveInside(IMAGES_DIR, uniqueName);
    
    fs.writeFileSync(targetPath, buffer);
    
    // Return relative URL path
    res.json({
      success: true,
      url: `/content/images/${uniqueName}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save base64 image.' });
  }
});

// ----------------------------------------------------
// STATIC SITE COMPILATION ENGINE
// ----------------------------------------------------
app.post('/api/publish', async (req, res) => {
  const log = [];
  const logMsg = (msg) => { log.push(`[SSG] ${msg}`); console.log(`[SSG] ${msg}`); };

  try {
    logMsg("Starting static compilation pipeline...");

    // 1. Read settings and verified templates
    const settings = readSettings();
    const templateName = settings.selectedTemplate || 'nordic-minimal';
    const activeTemplateDir = resolveInside(TEMPLATES_DIR, templateName);
    
    logMsg(`Selected template structure: "${templateName}"`);

    if (!fs.existsSync(activeTemplateDir)) {
      throw new Error(`Template directory not found: ${templateName}`);
    }

    // 2. Refresh output folder
    if (fs.existsSync(OUT_DIR)) {
      // Clear out older files, keeping .git if present to maintain history
      const files = fs.readdirSync(OUT_DIR);
      files.forEach(f => {
        if (f !== '.git') {
          fs.rmSync(path.join(OUT_DIR, f), { recursive: true, force: true });
        }
      });
      logMsg("Output directory out/ cleaned.");
    } else {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      logMsg("Created output directory out/");
    }

    // 3. Read posts (excl drafts for compilation)
    const posts = getAllPosts(false);
    logMsg(`Found ${posts.length} published posts to compile.`);

    // 4. Render markdown content for each post
    const compiledPosts = posts.map(post => {
      const html = renderMarkdown(post.content);
      return {
        ...post,
        rawContent: post.content,
        plainText: htmlToText(html),
        content: html
      };
    });
    const publishNow = new Date();

    // 5. Load EJS layouts
    const indexEjsPath = path.join(activeTemplateDir, 'index.ejs');
    const postEjsPath = path.join(activeTemplateDir, 'post.ejs');
    
    if (!fs.existsSync(indexEjsPath) || !fs.existsSync(postEjsPath)) {
      throw new Error("Missing index.ejs or post.ejs in templates folder.");
    }

    const indexTemplate = fs.readFileSync(indexEjsPath, 'utf-8');
    const postTemplate = fs.readFileSync(postEjsPath, 'utf-8');

    // 6. Build index/home page
    logMsg("Compiling blog home page (index.html)...");
    const homepageVariables = createDynamicVariables(settings, compiledPosts, null, publishNow);
    const homepageText = resolveSettingsText(settings, homepageVariables);
    const homepageMeta = createHomePageMeta(settings, homepageText, compiledPosts);
    
    const homepageData = {
      siteName: homepageText.siteName,
      siteSubtitle: homepageText.siteSubtitle,
      authorName: homepageText.authorName,
      authorBio: homepageText.authorBio,
      authorAvatar: settings.authorAvatar,
      socialLinks: settings.socialLinks,
      locale: settings.locale,
      themeText: settings.themeText,
      widgets: resolveWidgets(settings.widgets, homepageVariables, settings.locale),
      helpers: createTemplateHelpers(settings, homepageVariables),
      pageMeta: homepageMeta,
      variables: homepageVariables,
      posts: compiledPosts
    };

    const homeHtml = renderTemplate(indexTemplate, homepageData, `${templateName}/index.ejs`);
    fs.writeFileSync(path.join(OUT_DIR, 'index.html'), homeHtml, 'utf-8');
    fs.writeFileSync(path.join(OUT_DIR, 'index.html.md'), createHomeMarkdown(settings, homepageText, compiledPosts), 'utf-8');
    logMsg("Home page successfully written.");

    // 7. Build individual post pages under out/posts/[slug]/index.html for clean URLs
    const postsOutDir = path.join(OUT_DIR, 'posts');
    if (!fs.existsSync(postsOutDir)) {
      fs.mkdirSync(postsOutDir, { recursive: true });
    }

    for (const post of compiledPosts) {
      logMsg(`Compiling article page: "/posts/${post.slug}"...`);
      const singlePostDir = postOutputDir(post.slug);
      if (!fs.existsSync(singlePostDir)) {
        fs.mkdirSync(singlePostDir, { recursive: true });
      }
      const singlePostVariables = createDynamicVariables(settings, compiledPosts, post, publishNow);
      const singlePostText = resolveSettingsText(settings, singlePostVariables);
      const singlePostMeta = createPostPageMeta(settings, singlePostText, post);

      const singlePostData = {
        siteName: singlePostText.siteName,
        siteSubtitle: singlePostText.siteSubtitle,
        authorName: singlePostText.authorName,
        authorBio: singlePostText.authorBio,
        authorAvatar: settings.authorAvatar,
        socialLinks: settings.socialLinks,
        locale: settings.locale,
        themeText: settings.themeText,
        widgets: resolveWidgets(settings.widgets, singlePostVariables, settings.locale),
        helpers: createTemplateHelpers(settings, singlePostVariables),
        pageMeta: singlePostMeta,
        variables: singlePostVariables,
        posts: compiledPosts,
        post: post
      };

      const postHtml = renderTemplate(postTemplate, singlePostData, `${templateName}/post.ejs`, { requirePost: true });
      fs.writeFileSync(path.join(singlePostDir, 'index.html'), postHtml, 'utf-8');
      fs.writeFileSync(path.join(singlePostDir, 'index.html.md'), createPostMarkdown(settings, singlePostText, post), 'utf-8');
    }
    logMsg(`All ${compiledPosts.length} posts compiled successfully.`);

    // 8. Copy active template stylesheets and client assets
    const styleSrc = path.join(activeTemplateDir, 'style.css');
    if (fs.existsSync(styleSrc)) {
      fs.copyFileSync(styleSrc, path.join(OUT_DIR, 'style.css'));
      logMsg("Copied template stylesheet (style.css).");
    }

    const scriptSrc = path.join(activeTemplateDir, 'script.js');
    if (fs.existsSync(scriptSrc)) {
      fs.copyFileSync(scriptSrc, path.join(OUT_DIR, 'script.js'));
      logMsg("Copied template script asset (script.js).");
    }

    if (fs.existsSync(COMMON_SEARCH_SCRIPT)) {
      fs.copyFileSync(COMMON_SEARCH_SCRIPT, path.join(OUT_DIR, 'search.js'));
      logMsg("Copied shared search script (search.js).");
    }

    if (fs.existsSync(COMMON_SEARCH_STYLE)) {
      fs.copyFileSync(COMMON_SEARCH_STYLE, path.join(OUT_DIR, 'search.css'));
      logMsg("Copied shared search stylesheet (search.css).");
    }

    if (fs.existsSync(FAVICON_SOURCE)) {
      fs.copyFileSync(FAVICON_SOURCE, path.join(OUT_DIR, 'favicon.svg'));
      logMsg("Copied favicon asset (favicon.svg).");
    }

    // 9. Copy uploaded images
    const imagesOutDir = path.join(OUT_DIR, 'content', 'images');
    if (fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(imagesOutDir, { recursive: true });
      const imageFiles = fs.readdirSync(IMAGES_DIR);
      imageFiles.forEach(file => {
        fs.copyFileSync(path.join(IMAGES_DIR, file), path.join(imagesOutDir, file));
      });
      logMsg(`Copied ${imageFiles.length} uploaded images to static assets.`);
    }

    // 10. Generate search JSON index
    logMsg("Building client-side search database (search.json)...");
    const searchIndex = compiledPosts.map(p => ({
      title: p.title,
      slug: p.slug,
      url: absoluteUrl(settings, pagePathForPost(p)) || pagePathForPost(p),
      markdownUrl: absoluteUrl(settings, markdownPathForPost(p)) || markdownPathForPost(p),
      category: p.category,
      description: p.description,
      date: p.date,
      dateModified: p.modifiedAt || toIsoDate(p.date),
      formattedDate: formatDateForLocale(p.date, settings.locale),
      readingTime: p.readingTime,
      wordCount: p.wordCount,
      tags: p.tags
    }));
    fs.writeFileSync(path.join(OUT_DIR, 'search.json'), JSON.stringify(searchIndex, null, 2), 'utf-8');
    logMsg("Search database written.");

    fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), createSitemapXml(settings, compiledPosts, publishNow), 'utf-8');
    fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), createRobotsTxt(settings), 'utf-8');
    fs.writeFileSync(path.join(OUT_DIR, 'llms.txt'), createLlmsTxt(settings, homepageText, compiledPosts), 'utf-8');
    fs.writeFileSync(path.join(OUT_DIR, 'llms-full.txt'), createLlmsFullTxt(settings, homepageText, compiledPosts), 'utf-8');
    logMsg("Discovery files written (sitemap.xml, robots.txt, llms.txt).");

    logMsg("Static compilation process finished successfully!");
    res.json({ success: true, log });
  } catch (err) {
    logMsg(`CRITICAL SYSTEM COMPILE ERROR: ${err.message}`);
    res.status(500).json({ success: false, error: err.message, log });
  }
});

// ----------------------------------------------------
// GIT DEPLOYMENT CONTROLLER
// ----------------------------------------------------
app.post('/api/deploy', async (req, res) => {
  const { remoteUrl, branch = 'gh-pages', commitMessage = 'Publish: Static Pages Deploy' } = req.body;
  const log = [];
  const logMsg = (msg) => { log.push(`[DEPLOY] ${msg}`); console.log(`[DEPLOY] ${msg}`); };

  try {
    const safeRemoteUrl = validateRemoteUrl(remoteUrl);
    const safeBranch = validateBranch(branch);
    const safeCommitMessage = validateCommitMessage(commitMessage);
    logMsg(`Starting Git Deployment pipeline for branch "${safeBranch}"...`);

    // Ensure out directory exists
    if (!fs.existsSync(OUT_DIR) || fs.readdirSync(OUT_DIR).length <= 1) {
      throw new Error("No static files compiled yet. Run static compilation first.");
    }

    // Check if Git is initialized in out/
    const isGitRepo = fs.existsSync(path.join(OUT_DIR, '.git'));
    if (!isGitRepo) {
      logMsg("Initializing new local Git workspace inside /out...");
      await runCommand('git', ['init'], OUT_DIR);
      await runCommand('git', ['remote', 'add', 'origin', safeRemoteUrl], OUT_DIR);
      logMsg("Workspace successfully initialized with remote target.");
    } else {
      // Update remote just in case it changed
      try {
        await runCommand('git', ['remote', 'set-url', 'origin', safeRemoteUrl], OUT_DIR);
      } catch (err) {
        // If set-url fails because origin doesn't exist
        await runCommand('git', ['remote', 'add', 'origin', safeRemoteUrl], OUT_DIR);
      }
    }

    // Configure credentials locally inside the subfolder so we don't interfere with global configs
    logMsg("Configuring local directory git targets...");
    await runCommand('git', ['config', 'user.name', 'ZenithPress Compiler'], OUT_DIR);
    await runCommand('git', ['config', 'user.email', 'compiler@zenithpress.local'], OUT_DIR);

    // Checkout deployment branch
    try {
      logMsg(`Checking out branch: "${safeBranch}"...`);
      await runCommand('git', ['checkout', '-B', safeBranch], OUT_DIR);
    } catch (err) {
      // If branch checkout fails, create it
      await runCommand('git', ['checkout', '-b', safeBranch], OUT_DIR);
    }

    // Add and commit files
    logMsg("Staging files...");
    await runCommand('git', ['add', '.'], OUT_DIR);

    // Check git status to see if anything changed
    const status = await runCommand('git', ['status', '--porcelain'], OUT_DIR);
    if (!status.trim()) {
      logMsg("No changes detected since last publication.");
      return res.json({ success: true, message: "Static pages are already up-to-date.", log });
    }

    logMsg(`Committing updates: "${safeCommitMessage}"...`);
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const finalMsg = `${safeCommitMessage} (${dateStr})`;
    await runCommand('git', ['commit', '-m', finalMsg], OUT_DIR);

    // Push to GitHub
    logMsg(`Pushing assets to origin/${safeBranch}...`);
    // Using --force to guarantee hosting files replace whatever is currently in gh-pages
    await runCommand('git', ['push', 'origin', safeBranch, '--force'], OUT_DIR);

    logMsg("Pushed to GitHub Pages successfully!");
    res.json({ success: true, log });
  } catch (err) {
    logMsg(`DEPLOYMENT PIPELINE CRASHED: ${err.message || err.stderr || JSON.stringify(err)}`);
    res.status(err.statusCode || 500).json({ success: false, error: err.message || err.stderr, log });
  }
});

// For index fallback in admin SPA routing
app.get('/admin*', (req, res) => {
  const spaIndex = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(spaIndex)) {
    res.sendFile(spaIndex);
  } else {
    res.status(404).send("ZenithPress Server: Admin panel UI not built yet. Run `npm run build` first.");
  }
});

// Standard public site 404 fallback
app.get('*', (req, res) => {
  res.status(404).send("404: Sector Not Found on ZenithPress Static Blog.");
});

// Run Server
app.listen(PORT, () => {
  console.log(`===========================================================`);
  console.log(` ZenithPress Local Server is listening on port ${PORT}      `);
  console.log(` Access public website at http://localhost:${PORT}         `);
  console.log(` Access admin dashboard at http://localhost:${PORT}/admin  `);
  console.log(`===========================================================`);
});
