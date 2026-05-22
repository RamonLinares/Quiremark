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
const configuredDataDir = process.env.BLOGSYSTEM_DATA_DIR || process.env.ZENITHPRESS_DATA_DIR || '';
const DATA_DIR = configuredDataDir ? path.resolve(configuredDataDir) : __dirname;

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
const DEFAULT_PUBLIC_FEATURES = {
  search: true,
  newsletter: true,
  about: true,
  rss: true,
  categories: true
};
const DEFAULT_ANALYTICS_SETTINGS = {
  googleMeasurementId: ''
};
const DEFAULT_DEPLOY_SETTINGS = {
  remoteUrl: '',
  branch: 'gh-pages',
  commitMessage: 'Publish: Static Pages Deploy'
};
const DEFAULT_CATEGORIES = [
  {
    slug: 'design',
    name: 'Design',
    description: 'Visual design, brand systems, typography, and creative direction.',
    color: '#a855f7'
  },
  {
    slug: 'development',
    name: 'Development',
    description: 'Engineering notes, architecture, tooling, and implementation details.',
    color: '#06b6d4'
  },
  {
    slug: 'creative',
    name: 'Creative',
    description: 'Experiments across art, media, writing, and making.',
    color: '#ec4899'
  },
  {
    slug: 'tech',
    name: 'Tech',
    description: 'Technology trends, platforms, and digital culture.',
    color: '#22c55e'
  }
];
const SUPPORTED_LOCALES = {
  en: 'English',
  es: 'Español',
  ca: 'Català',
  zh: '中文'
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
  'features',
  'themeText',
  'widgets',
  'categories',
  'currentCategory',
  'allPosts',
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
  'longDate',
  'categoryLink',
  'categoryNav',
  'categoryArchiveHeader',
  'consentDialog'
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
    'RSS Feed': 'Canal RSS',
    'Category': 'Categoría',
    'Categories': 'Categorías',
    'All Posts': 'Todas las publicaciones',
    'Category Archive': 'Archivo de categoría',
    'Privacy preferences': 'Preferencias de privacidad',
    'Analytics preferences': 'Preferencias de analítica',
    'We use Google Analytics in a privacy-first mode to understand aggregate traffic, popular links, and page performance.': 'Usamos Google Analytics en un modo orientado a la privacidad para entender el tráfico agregado, los enlaces populares y el rendimiento de la página.',
    'Reject optional keeps the site fully functional without analytics cookies. Google may still receive cookieless, aggregate measurement signals. You can change this later from Privacy preferences.': 'Rechazar lo opcional mantiene el sitio totalmente funcional sin cookies de analítica. Google puede seguir recibiendo señales agregadas de medición sin cookies. Puedes cambiarlo más tarde desde Preferencias de privacidad.',
    'Reject optional': 'Rechazar opcional',
    'Accept optional': 'Aceptar opcional',
    'Inner Circle Newsletter': 'Boletín del círculo interno',
    'Custom HTML Block': 'Bloque HTML personalizado',
    'Enter your email...': 'Introduce tu correo...',
    'Enter your email for weekly updates...': 'Introduce tu correo para recibir novedades semanales...'
  },
  ca: {
    'Home': 'Inici',
    'VOL.': 'VOL.',
    'NO.': 'NÚM.',
    'Search Archive': 'Cerca a l’arxiu',
    'Search posts, categories, or tags...': 'Cerca publicacions, categories o etiquetes...',
    'No matching posts found.': 'No s’han trobat publicacions coincidents.',
    'No posts published yet.': 'Encara no hi ha publicacions.',
    '[ERROR: NO_POSTS_FOUND_IN_SECTOR]': '[ERROR: NO_HI_HA_PUBLICACIONS_AL_SECTOR]',
    'NO ARTICLES REGISTERED IN ARCHIVES.': 'NO HI HA ARTICLES REGISTRATS A L’ARXIU.',
    'No publications found in the forest archives.': 'No s’han trobat publicacions als arxius del bosc.',
    'NO STATIC DATA SECTORS DETECTED.': 'NO S’HAN DETECTAT SECTORS DE DADES ESTÀTIQUES.',
    'Read Entry →': 'Llegeix l’entrada →',
    'Explore Article →': 'Explora l’article →',
    '[ EXECUTE_POST_READER ]': '[ EXECUTA_LECTOR ]',
    'READ FULL STORY →': 'LLEGEIX LA HISTÒRIA COMPLETA →',
    'CONTINUE READING': 'CONTINUA LLEGINT',
    'LOAD ARTICLE_': 'CARREGA_ARTICLE_',
    '← Back to Musings': '← Torna a les reflexions',
    '← Back to Dashboard': '← Torna al tauler',
    '[ BACK_TO_DIRECTORY ]': '[ TORNA_AL_DIRECTORI ]',
    '← BACK TO GAZETTE DIRECTORY': '← TORNA AL DIRECTORI DE LA GASETA',
    '← BACK TO TREE HIERARCHY': '← TORNA A LA JERARQUIA',
    'System Status: ONLINE': 'Estat del sistema: EN LÍNIA',
    'EDITION: DIGITAL AESTHETICS': 'EDICIÓ: ESTÈTICA DIGITAL',
    'Subscribe for the latest design & dev updates directly to your inbox.': 'Subscriu-te per rebre les últimes novetats de disseny i desenvolupament directament al correu.',
    'Subscribe for weekly drops of design, coding, and futuristic aesthetics.': 'Subscriu-te a lliuraments setmanals de disseny, codi i estètica futurista.',
    'CONNECT TO SECTOR NEWSLETTER STREAM.': 'CONNECTA AL FLUX DEL BUTLLETÍ DEL SECTOR.',
    'Subscribe to our wire updates. Delivered instantly to your visual cortex.': 'Subscriu-te a les nostres actualitzacions. Lliurament instantani al teu còrtex visual.',
    'Join the clearing. Receive our monthly letter on art, design, and mindful living.': 'Uneix-te al clar. Rep la nostra carta mensual sobre art, disseny i vida conscient.',
    'Subscribe to transmit the latest digital aesthetic logs directly to your matrix terminal.': 'Subscriu-te per transmetre els últims registres d’estètica digital directament al teu terminal matriu.',
    'Your email address': 'La teva adreça electrònica',
    'Email address': 'Adreça electrònica',
    'admin@domain.com': 'admin@domini.com',
    'your.email@wire.com': 'el.teu.email@cable.com',
    'your.email@nature.com': 'el.teu.email@natura.com',
    'SYSTEM@DOMAIN.EXE': 'SISTEMA@DOMINI.EXE',
    'Subscribe': 'Subscriu-me',
    'SUBSCRIBE': 'SUBSCRIU-ME',
    '[ INJECT ]': '[ INJECTA ]',
    'JOIN LETTERS': 'UNEIX-ME',
    'TRANSMIT': 'TRANSMET',
    'Configure newsletter endpoint': 'Configura l’endpoint del butlletí',
    'CONFIGURE_ENDPOINT': 'CONFIGURA_ENDPOINT',
    'CONFIGURE WIRE ENDPOINT': 'CONFIGURA L’ENDPOINT DEL CABLE',
    'CONFIGURE_ENDPOINT.EXE': 'CONFIGURA_ENDPOINT.EXE',
    'Configure': 'Configura',
    'CONFIGURE': 'CONFIGURA',
    '[ CONFIG ]': '[ CONFIGURA ]',
    'CONFIG': 'CONFIGURA',
    'Email Address': 'Adreça electrònica',
    'Terminal Email Address': 'Adreça electrònica del terminal',
    'Newsletter input': 'Camp del butlletí',
    'E-mail for newsletter': 'Correu per al butlletí',
    'Neon Email Terminal': 'Terminal de correu neó',
    'All rights reserved.': 'Tots els drets reservats.',
    'ALL RIGHTS SECURED.': 'TOTS ELS DRETS ASSEGURATS.',
    'UNCOMPROMISING DIGITAL DISPATCH.': 'DESPATX DIGITAL SENSE CONCESSIONS.',
    'SUSTAINED IN HARMONY WITH DIGITAL ECOSYSTEMS.': 'SOSTINGUT EN HARMONIA AMB ECOSISTEMES DIGITALS.',
    'ALL PROTOCOLS SECURED.': 'TOTS ELS PROTOCOLS ASSEGURATS.',
    'Powered by': 'Creat amb',
    'POWERED BY': 'CREAT AMB',
    'COMPILED_BY:': 'COMPILAT_PER:',
    'DESIGNED ON': 'DISSENYAT A',
    'SYSTEM_ENGINE:': 'MOTOR_DEL_SISTEMA:',
    'NAME:': 'NOM:',
    'About Me': 'Sobre mi',
    'Recent Posts': 'Publicacions recents',
    'Recent Musings': 'Reflexions recents',
    'Topics': 'Temes',
    'Newsletter': 'Butlletí',
    'RSS Feed': 'Canal RSS',
    'Category': 'Categoria',
    'Categories': 'Categories',
    'All Posts': 'Totes les publicacions',
    'Category Archive': 'Arxiu de categoria',
    'Privacy preferences': 'Preferències de privadesa',
    'Analytics preferences': 'Preferències d’analítica',
    'We use Google Analytics in a privacy-first mode to understand aggregate traffic, popular links, and page performance.': 'Fem servir Google Analytics en un mode orientat a la privadesa per entendre el trànsit agregat, els enllaços populars i el rendiment de la pàgina.',
    'Reject optional keeps the site fully functional without analytics cookies. Google may still receive cookieless, aggregate measurement signals. You can change this later from Privacy preferences.': 'Rebutjar l’opcional manté el lloc completament funcional sense galetes d’analítica. Google encara pot rebre senyals agregats de mesura sense galetes. Ho pots canviar més endavant des de Preferències de privadesa.',
    'Reject optional': 'Rebutja l’opcional',
    'Accept optional': 'Accepta l’opcional',
    'Inner Circle Newsletter': 'Butlletí del cercle intern',
    'Custom HTML Block': 'Bloc HTML personalitzat',
    'Enter your email...': 'Introdueix el teu correu...',
    'Enter your email for weekly updates...': 'Introdueix el teu correu per rebre novetats setmanals...'
  },
  zh: {
    'Home': '首页',
    'VOL.': '卷',
    'NO.': '期',
    'Search Archive': '搜索归档',
    'Search posts, categories, or tags...': '搜索文章、分类或标签...',
    'No matching posts found.': '未找到匹配的文章。',
    'No posts published yet.': '还没有发布文章。',
    '[ERROR: NO_POSTS_FOUND_IN_SECTOR]': '[错误：该区域没有文章]',
    'NO ARTICLES REGISTERED IN ARCHIVES.': '归档中没有登记文章。',
    'No publications found in the forest archives.': '森林归档中没有找到文章。',
    'NO STATIC DATA SECTORS DETECTED.': '未检测到静态数据区域。',
    'Read Entry →': '阅读条目 →',
    'Explore Article →': '查看文章 →',
    '[ EXECUTE_POST_READER ]': '[ 执行文章阅读器 ]',
    'READ FULL STORY →': '阅读全文 →',
    'CONTINUE READING': '继续阅读',
    'LOAD ARTICLE_': '加载文章_',
    '← Back to Musings': '← 返回随笔',
    '← Back to Dashboard': '← 返回面板',
    '[ BACK_TO_DIRECTORY ]': '[ 返回目录 ]',
    '← BACK TO GAZETTE DIRECTORY': '← 返回公报目录',
    '← BACK TO TREE HIERARCHY': '← 返回树形层级',
    'System Status: ONLINE': '系统状态：在线',
    'EDITION: DIGITAL AESTHETICS': '版本：数字美学',
    'Subscribe for the latest design & dev updates directly to your inbox.': '订阅后即可在收件箱中收到最新设计与开发动态。',
    'Subscribe for weekly drops of design, coding, and futuristic aesthetics.': '订阅每周设计、代码与未来美学更新。',
    'CONNECT TO SECTOR NEWSLETTER STREAM.': '连接到区域通讯流。',
    'Subscribe to our wire updates. Delivered instantly to your visual cortex.': '订阅我们的快讯，实时送达你的视觉皮层。',
    'Join the clearing. Receive our monthly letter on art, design, and mindful living.': '加入这片空地，接收关于艺术、设计与正念生活的月度来信。',
    'Subscribe to transmit the latest digital aesthetic logs directly to your matrix terminal.': '订阅后将最新数字美学日志传输到你的矩阵终端。',
    'Your email address': '你的电子邮箱',
    'Email address': '电子邮箱',
    'admin@domain.com': 'admin@domain.com',
    'your.email@wire.com': 'your.email@wire.com',
    'your.email@nature.com': 'your.email@nature.com',
    'SYSTEM@DOMAIN.EXE': 'SYSTEM@DOMAIN.EXE',
    'Subscribe': '订阅',
    'SUBSCRIBE': '订阅',
    '[ INJECT ]': '[ 注入 ]',
    'JOIN LETTERS': '加入来信',
    'TRANSMIT': '传输',
    'Configure newsletter endpoint': '配置通讯端点',
    'CONFIGURE_ENDPOINT': '配置端点',
    'CONFIGURE WIRE ENDPOINT': '配置快讯端点',
    'CONFIGURE_ENDPOINT.EXE': '配置端点.EXE',
    'Configure': '配置',
    'CONFIGURE': '配置',
    '[ CONFIG ]': '[ 配置 ]',
    'CONFIG': '配置',
    'Email Address': '电子邮箱',
    'Terminal Email Address': '终端电子邮箱',
    'Newsletter input': '通讯输入框',
    'E-mail for newsletter': '通讯邮箱',
    'Neon Email Terminal': '霓虹邮箱终端',
    'All rights reserved.': '保留所有权利。',
    'ALL RIGHTS SECURED.': '所有权利已保留。',
    'UNCOMPROMISING DIGITAL DISPATCH.': '坚定的数字快讯。',
    'SUSTAINED IN HARMONY WITH DIGITAL ECOSYSTEMS.': '与数字生态系统和谐共存。',
    'ALL PROTOCOLS SECURED.': '所有协议已保护。',
    'Powered by': '技术支持',
    'POWERED BY': '技术支持',
    'COMPILED_BY:': '编译者：',
    'DESIGNED ON': '设计平台',
    'SYSTEM_ENGINE:': '系统引擎：',
    'NAME:': '名称：',
    'About Me': '关于我',
    'Recent Posts': '最新文章',
    'Recent Musings': '最新随笔',
    'Topics': '主题',
    'Newsletter': '通讯',
    'RSS Feed': 'RSS 订阅',
    'Category': '分类',
    'Categories': '分类',
    'All Posts': '所有文章',
    'Category Archive': '分类归档',
    'Privacy preferences': '隐私偏好',
    'Analytics preferences': '分析偏好',
    'We use Google Analytics in a privacy-first mode to understand aggregate traffic, popular links, and page performance.': '我们以注重隐私的方式使用 Google Analytics，用于了解汇总流量、热门链接和页面性能。',
    'Reject optional keeps the site fully functional without analytics cookies. Google may still receive cookieless, aggregate measurement signals. You can change this later from Privacy preferences.': '拒绝可选项后，网站仍可完整运行且不会使用分析 Cookie。Google 仍可能收到无 Cookie 的汇总测量信号。你之后可以在隐私偏好中更改此设置。',
    'Reject optional': '拒绝可选项',
    'Accept optional': '接受可选项',
    'Inner Circle Newsletter': '内圈通讯',
    'Custom HTML Block': '自定义 HTML 区块',
    'Enter your email...': '输入你的邮箱...',
    'Enter your email for weekly updates...': '输入邮箱以接收每周更新...'
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
const REPO_CONTENT_DIR = path.join(__dirname, 'content');
const REPO_SITES_DIR = path.join(__dirname, 'sites');
const CONTENT_DIR = path.join(DATA_DIR, 'content');
const POSTS_DIR = path.join(CONTENT_DIR, 'posts');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const OUT_DIR = path.join(DATA_DIR, 'out');
const SITES_DIR = path.join(DATA_DIR, 'sites');
const SITES_REGISTRY_FILE = path.join(SITES_DIR, 'registry.json');
const MAIN_SITE_ID = 'main';
const PUBLIC_DIR = path.join(__dirname, 'public');
const COMMON_SEARCH_SCRIPT = path.join(TEMPLATES_DIR, 'search.js');
const COMMON_SEARCH_STYLE = path.join(TEMPLATES_DIR, 'search.css');
const COMMON_TAXONOMY_STYLE = path.join(TEMPLATES_DIR, 'taxonomy.css');
const COMMON_CONSENT_SCRIPT = path.join(TEMPLATES_DIR, 'consent.js');
const COMMON_CONSENT_STYLE = path.join(TEMPLATES_DIR, 'consent.css');
const FAVICON_SOURCE = path.join(PUBLIC_DIR, 'favicon.svg');

function seedDirectoryIfEmpty(sourceDir, targetDir) {
  if (path.resolve(sourceDir) === path.resolve(targetDir) || !fs.existsSync(sourceDir)) return;
  const hasExistingData = fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0;
  if (hasExistingData) return;
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

if (configuredDataDir) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  seedDirectoryIfEmpty(REPO_CONTENT_DIR, CONTENT_DIR);
  seedDirectoryIfEmpty(REPO_SITES_DIR, SITES_DIR);
}

// Ensure necessary directories exist on startup
[DATA_DIR, CONTENT_DIR, POSTS_DIR, IMAGES_DIR, OUT_DIR, SITES_DIR].forEach(dir => {
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

app.use('/preview/:siteId', (req, res, next) => {
  try {
    const { record } = getSiteRecord(req.params.siteId);
    const site = getSiteContext(record.id);
    ensureSiteDirectories(site);
    return serveNoCache(site.outDir)(req, res, next);
  } catch (err) {
    return res.status(err.statusCode || 404).send(err.message || 'Website preview not found.');
  }
});

app.use('/site-assets/:siteId/content/images', (req, res, next) => {
  try {
    const { record } = getSiteRecord(req.params.siteId);
    const site = getSiteContext(record.id);
    ensureSiteDirectories(site);
    return serveNoCache(site.imagesDir)(req, res, next);
  } catch (err) {
    return res.status(err.statusCode || 404).send(err.message || 'Website assets not found.');
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



function createDefaultSettings(overrides = {}) {
  return {
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
    features: { ...DEFAULT_PUBLIC_FEATURES },
    categories: DEFAULT_CATEGORIES,
    analytics: { ...DEFAULT_ANALYTICS_SETTINGS },
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
    ],
    ...overrides
  };
}

// Setup initial settings if not present
const SETTINGS_FILE = path.join(CONTENT_DIR, 'settings.json');
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(createDefaultSettings(), null, 2), 'utf-8');
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

function normalizeSiteId(value) {
  const siteId = slugify(String(value || '').trim()).slice(0, 40);
  if (!siteId || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(siteId)) {
    const err = new Error('Website ID must use lowercase letters, numbers, and hyphens.');
    err.statusCode = 400;
    throw err;
  }
  return siteId;
}

function normalizeSiteName(value, fallback = 'Untitled Website') {
  return String(value || fallback).replace(/\0/g, '').trim().slice(0, 80) || fallback;
}

function normalizeDeploySettings(deploy = {}) {
  return {
    remoteUrl: deploy.remoteUrl ? validateRemoteUrl(deploy.remoteUrl) : '',
    branch: deploy.branch ? validateBranch(deploy.branch) : DEFAULT_DEPLOY_SETTINGS.branch,
    commitMessage: deploy.commitMessage
      ? validateCommitMessage(deploy.commitMessage)
      : DEFAULT_DEPLOY_SETTINGS.commitMessage
  };
}

function getSiteContext(siteId = MAIN_SITE_ID) {
  const id = normalizeSiteId(siteId || MAIN_SITE_ID);
  if (id === MAIN_SITE_ID) {
    return {
      id,
      baseDir: DATA_DIR,
      contentDir: CONTENT_DIR,
      postsDir: POSTS_DIR,
      imagesDir: IMAGES_DIR,
      settingsFile: SETTINGS_FILE,
      outDir: OUT_DIR
    };
  }
  const baseDir = resolveInside(SITES_DIR, id);
  const contentDir = resolveInside(baseDir, 'content');
  return {
    id,
    baseDir,
    contentDir,
    postsDir: resolveInside(contentDir, 'posts'),
    imagesDir: resolveInside(contentDir, 'images'),
    settingsFile: resolveInside(contentDir, 'settings.json'),
    outDir: resolveInside(baseDir, 'out')
  };
}

function ensureSiteDirectories(site) {
  [site.baseDir, site.contentDir, site.postsDir, site.imagesDir, site.outDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  if (!fs.existsSync(site.settingsFile)) {
    fs.writeFileSync(site.settingsFile, JSON.stringify(createDefaultSettings(), null, 2), 'utf-8');
  }
}

function normalizeSiteRecord(record = {}) {
  const id = normalizeSiteId(record.id || MAIN_SITE_ID);
  const deploy = normalizeDeploySettings(record.deploy || {});
  return {
    id,
    name: normalizeSiteName(record.name, id === MAIN_SITE_ID ? 'Main Website' : id),
    deploy,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString()
  };
}

function readSiteRegistry() {
  let registry = null;
  if (fs.existsSync(SITES_REGISTRY_FILE)) {
    try {
      registry = JSON.parse(fs.readFileSync(SITES_REGISTRY_FILE, 'utf-8'));
    } catch {
      registry = null;
    }
  }

  const currentSettings = fs.existsSync(SETTINGS_FILE)
    ? normalizeSettings(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')))
    : createDefaultSettings();
  const records = Array.isArray(registry?.sites) ? registry.sites : [];
  const siteMap = new Map(records.map(record => {
    const normalized = normalizeSiteRecord(record);
    return [normalized.id, normalized];
  }));

  if (!siteMap.has(MAIN_SITE_ID)) {
    siteMap.set(MAIN_SITE_ID, normalizeSiteRecord({
      id: MAIN_SITE_ID,
      name: currentSettings.siteName || 'Main Website'
    }));
  }

  const activeSiteId = siteMap.has(registry?.activeSiteId)
    ? registry.activeSiteId
    : MAIN_SITE_ID;

  const normalizedRegistry = {
    activeSiteId,
    sites: [...siteMap.values()]
  };
  writeSiteRegistry(normalizedRegistry);
  return normalizedRegistry;
}

function writeSiteRegistry(registry) {
  if (!fs.existsSync(SITES_DIR)) fs.mkdirSync(SITES_DIR, { recursive: true });
  fs.writeFileSync(SITES_REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8');
}

function getSiteRecord(siteId) {
  const id = normalizeSiteId(siteId || MAIN_SITE_ID);
  const registry = readSiteRegistry();
  const record = registry.sites.find(site => site.id === id);
  if (!record) {
    const err = new Error(`Website "${id}" was not found.`);
    err.statusCode = 404;
    throw err;
  }
  return { registry, record };
}

function getSiteContextFromRequest(req) {
  const requestedId = req.get('X-Zenith-Site') || req.query.site || readSiteRegistry().activeSiteId;
  const { record } = getSiteRecord(requestedId);
  const context = getSiteContext(record.id);
  ensureSiteDirectories(context);
  return { ...context, record };
}

function postFilePath(site, slug) {
  assertValidSlug(slug);
  return resolveInside(site.postsDir, `${slug}.md`);
}

function postOutputDir(site, slug) {
  assertValidSlug(slug);
  return resolveInside(path.join(site.outDir, 'posts'), slug);
}

function categoryOutputDir(site, slug) {
  assertValidSlug(slug);
  return resolveInside(path.join(site.outDir, 'categories'), slug);
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

function normalizeGoogleMeasurementId(value) {
  const measurementId = String(value || '').trim().toUpperCase();
  return measurementId.length <= 32 && /^G-[A-Z0-9]+$/.test(measurementId) ? measurementId : '';
}

function normalizeAnalyticsSettings(analytics = {}) {
  return {
    googleMeasurementId: normalizeGoogleMeasurementId(analytics.googleMeasurementId || analytics.measurementId)
  };
}

function isAnalyticsConfigured(settings) {
  return Boolean(settings.analytics?.googleMeasurementId);
}

function normalizeKeywordList(value) {
  const keywords = Array.isArray(value) ? value : String(value || '').split(',');
  return keywords
    .map(keyword => String(keyword).trim())
    .filter(Boolean)
    .slice(0, 24)
    .join(', ');
}

function normalizeColor(value, fallback = '#64748b') {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
}

function normalizeCategory(category = {}, fallback = DEFAULT_CATEGORIES[0], index = 0) {
  const fallbackCategory = fallback || DEFAULT_CATEGORIES[0];
  const name = String(category.name || category.label || category.title || category.slug || fallbackCategory.name || 'Category')
    .replace(/\0/g, '')
    .trim()
    .slice(0, 80) || fallbackCategory.name;
  const candidateSlug = slugify(category.slug || name || fallbackCategory.slug).slice(0, 64).replace(/^-+|-+$/g, '');
  const slug = isValidSlug(candidateSlug) ? candidateSlug : `${fallbackCategory.slug || 'category'}-${index + 1}`;
  return {
    slug,
    name,
    description: String(category.description || '')
      .replace(/\0/g, '')
      .trim()
      .slice(0, 260),
    color: normalizeColor(category.color, fallbackCategory.color || '#64748b')
  };
}

function normalizeCategories(categories = DEFAULT_CATEGORIES) {
  const source = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES;
  const seen = new Set();
  const normalized = [];

  source.forEach((category, index) => {
    const fallback = DEFAULT_CATEGORIES[index] || DEFAULT_CATEGORIES[0];
    let normalizedCategory = normalizeCategory(category, fallback, index);
    if (seen.has(normalizedCategory.slug)) {
      normalizedCategory = {
        ...normalizedCategory,
        slug: `${normalizedCategory.slug}-${index + 1}`
      };
    }
    seen.add(normalizedCategory.slug);
    normalized.push(normalizedCategory);
  });

  return normalized.length
    ? normalized
    : DEFAULT_CATEGORIES.map((category, index) => normalizeCategory(category, DEFAULT_CATEGORIES[index], index));
}

function resolveCategoryReference(value, categories) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return categories[0];
  const slug = slugify(rawValue);
  const lowerValue = rawValue.toLowerCase();
  return categories.find(category => (
    category.slug === slug ||
    category.slug === rawValue ||
    category.name.toLowerCase() === lowerValue
  )) || null;
}

function normalizePostCategory(value, categories, options = {}) {
  const match = resolveCategoryReference(value, categories);
  if (match) return match.slug;

  if (options.strict) {
    const err = new Error('Post category must match one of the configured categories.');
    err.statusCode = 400;
    throw err;
  }

  return categories[0]?.slug || DEFAULT_CATEGORIES[0].slug;
}

function decoratePostCategory(post, categories) {
  const category = resolveCategoryReference(post.category, categories) || categories[0] || DEFAULT_CATEGORIES[0];
  return {
    ...post,
    category: category.slug,
    categorySlug: category.slug,
    categoryName: category.name,
    categoryDescription: category.description,
    categoryColor: category.color,
    categoryUrl: categoryPathForCategory(category)
  };
}

function buildCategorySummaries(categories, posts, settings) {
  const counts = posts.reduce((acc, post) => {
    const slug = post.categorySlug || post.category;
    if (slug) acc[slug] = (acc[slug] || 0) + 1;
    return acc;
  }, {});

  return categories.map(category => ({
    ...category,
    url: categoryPathForCategory(category),
    absoluteUrl: absoluteUrl(settings, categoryPathForCategory(category)) || categoryPathForCategory(category),
    postCount: counts[category.slug] || 0
  }));
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

function categoryPathForCategory(category) {
  return category?.slug ? `/categories/${category.slug}/` : '/';
}

function categoryMarkdownPath(category) {
  return category?.slug ? `/categories/${category.slug}/index.html.md` : '/index.html.md';
}

function ogLocale(locale) {
  const map = {
    en: 'en_US',
    es: 'es_ES',
    ca: 'ca_ES',
    zh: 'zh_CN'
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

function createHomePageMeta(settings, homepageText, posts, categories = []) {
  const description = truncateText(settings.seoDescription || homepageText.siteSubtitle || homepageText.authorBio, 180);
  const titleSuffix = homepageText.siteSubtitle ? homepageText.siteSubtitle : translateText('Home', settings.locale);
  const title = `${homepageText.siteName} | ${titleSuffix}`;
  const url = absoluteUrl(settings, '/');
  const image = assetUrl(settings, settings.seoImage || settings.authorAvatar);
  const keywords = mergeKeywords(settings.seoKeywords, posts.flatMap(post => [post.categoryName, ...(post.tags || [])]));
  const feedUrl = settings.features.rss ? (absoluteUrl(settings, '/feed.xml') || '/feed.xml') : '';
  const websiteSchema = {
    '@type': 'WebSite',
    '@id': absoluteUrl(settings, '/#website') || '#website',
    name: homepageText.siteName,
    url: url || '/',
    inLanguage: settings.locale,
    description,
    publisher: { '@id': absoluteUrl(settings, '/#publisher') || '#publisher' }
  };

  if (settings.features.search) {
    websiteSchema.potentialAction = {
      '@type': 'SearchAction',
      target: `${url || '/'}?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    };
  }

  const graph = [
    createPublisherSchema(settings),
    createPersonSchema(settings),
    websiteSchema,
    {
      '@type': 'Blog',
      '@id': absoluteUrl(settings, '/#blog') || '#blog',
      name: homepageText.siteName,
      url: url || '/',
      inLanguage: settings.locale,
      description,
      author: { '@id': absoluteUrl(settings, '/#author') || '#author' },
      publisher: { '@id': absoluteUrl(settings, '/#publisher') || '#publisher' },
      about: categories.map(category => ({
        '@type': 'Thing',
        name: category.name,
        url: category.absoluteUrl || categoryPathForCategory(category)
      })),
      blogPost: posts.map(post => ({
        '@type': 'BlogPosting',
        '@id': `${absoluteUrl(settings, pagePathForPost(post)) || pagePathForPost(post)}#blogposting`,
        headline: post.title,
        url: absoluteUrl(settings, pagePathForPost(post)) || pagePathForPost(post),
        datePublished: toIsoDate(post.date),
        dateModified: post.modifiedAt || toIsoDate(post.date),
        ...(post.categoryName ? { articleSection: post.categoryName } : {})
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
    feedUrl,
    feedTitle: `${homepageText.siteName} ${translateText('RSS Feed', settings.locale)}`,
    jsonLd: { '@context': 'https://schema.org', '@graph': graph }
  };
}

function createPostPageMeta(settings, homepageText, post) {
  const description = truncateText(post.description || post.plainText, 180);
  const url = absoluteUrl(settings, pagePathForPost(post));
  const image = assetUrl(settings, post.coverImage || settings.seoImage || settings.authorAvatar);
  const keywords = mergeKeywords(settings.seoKeywords, post.categoryName, post.tags);
  const feedUrl = settings.features.rss ? (absoluteUrl(settings, '/feed.xml') || '/feed.xml') : '';
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
      ...(post.categoryName ? { articleSection: post.categoryName } : {}),
      ...(post.categoryUrl ? { about: { '@type': 'Thing', name: post.categoryName, url: absoluteUrl(settings, post.categoryUrl) || post.categoryUrl } } : {}),
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
    section: post.categoryName,
    tags: post.tags || [],
    author: settings.authorName,
    feedUrl,
    feedTitle: `${homepageText.siteName} ${translateText('RSS Feed', settings.locale)}`,
    jsonLd: { '@context': 'https://schema.org', '@graph': graph }
  };
}

function createCategoryPageMeta(settings, homepageText, category, posts) {
  const categoryUrl = absoluteUrl(settings, categoryPathForCategory(category));
  const description = truncateText(
    category.description || `${translateText('Category Archive', settings.locale)}: ${category.name}`,
    180
  );
  const keywords = mergeKeywords(settings.seoKeywords, category.name, posts.flatMap(post => post.tags || []));
  const feedUrl = settings.features.rss ? (absoluteUrl(settings, '/feed.xml') || '/feed.xml') : '';
  const categoryPath = categoryPathForCategory(category);
  const graph = [
    createPublisherSchema(settings),
    createPersonSchema(settings),
    {
      '@type': 'BreadcrumbList',
      '@id': `${categoryUrl || categoryPath}#breadcrumb`,
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
          name: category.name,
          item: categoryUrl || categoryPath
        }
      ]
    },
    {
      '@type': 'CollectionPage',
      '@id': `${categoryUrl || categoryPath}#collection`,
      name: `${category.name} | ${homepageText.siteName}`,
      url: categoryUrl || categoryPath,
      inLanguage: settings.locale,
      description,
      isPartOf: { '@id': absoluteUrl(settings, '/#blog') || '#blog' },
      about: {
        '@type': 'Thing',
        name: category.name,
        description: category.description || undefined
      },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: posts.length,
        itemListElement: posts.map((post, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: absoluteUrl(settings, pagePathForPost(post)) || pagePathForPost(post),
          name: post.title
        }))
      }
    }
  ];

  return {
    type: 'website',
    title: `${category.name} | ${homepageText.siteName}`,
    description,
    canonicalUrl: categoryUrl,
    markdownUrl: absoluteUrl(settings, categoryMarkdownPath(category)) || categoryMarkdownPath(category),
    image: assetUrl(settings, settings.seoImage || settings.authorAvatar),
    keywords,
    robots: settings.allowIndexing ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
    locale: ogLocale(settings.locale),
    feedUrl,
    feedTitle: `${homepageText.siteName} ${translateText('RSS Feed', settings.locale)}`,
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

function createSitemapXml(settings, posts, categories = [], generatedAt) {
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
    })),
    ...categories.map(category => ({
      loc: absoluteUrl(settings, categoryPathForCategory(category)),
      lastmod: toIsoDateOnly(generatedAt),
      changefreq: 'weekly',
      priority: category.postCount > 0 ? '0.6' : '0.3'
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

function rssDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

function cdata(value) {
  return `<![CDATA[${String(value || '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

function createRssFeedXml(settings, homepageText, posts, generatedAt) {
  const siteUrl = absoluteUrl(settings, '/') || '/';
  const feedUrl = absoluteUrl(settings, '/feed.xml') || '/feed.xml';
  const feedTitle = `${homepageText.siteName} ${translateText('RSS Feed', settings.locale)}`;
  const description = settings.seoDescription || homepageText.siteSubtitle || 'Static blog archive.';
  const feedImage = assetUrl(settings, settings.seoImage || settings.authorAvatar);
  const items = posts.map(post => {
    const postUrl = absoluteUrl(settings, pagePathForPost(post)) || pagePathForPost(post);
    const categories = [post.categoryName, ...(post.tags || [])].filter(Boolean);
    return [
      '    <item>',
      `      <title>${xmlEscape(post.title)}</title>`,
      `      <link>${xmlEscape(postUrl)}</link>`,
      `      <guid isPermaLink="true">${xmlEscape(postUrl)}</guid>`,
      `      <description>${xmlEscape(post.description || post.plainText || '')}</description>`,
      `      <pubDate>${xmlEscape(rssDate(post.date))}</pubDate>`,
      `      <dc:creator>${xmlEscape(settings.authorName || settings.siteName)}</dc:creator>`,
      ...categories.map(category => `      <category>${xmlEscape(category)}</category>`),
      `      <content:encoded>${cdata(post.content || '')}</content:encoded>`,
      '    </item>'
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    <title>${xmlEscape(feedTitle)}</title>`,
    `    <link>${xmlEscape(siteUrl)}</link>`,
    `    <description>${xmlEscape(description)}</description>`,
    `    <language>${xmlEscape(settings.locale)}</language>`,
    `    <lastBuildDate>${xmlEscape(rssDate(generatedAt))}</lastBuildDate>`,
    `    <generator>ZenithPress</generator>`,
    `    <atom:link href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml" />`,
    feedImage ? `    <image><url>${xmlEscape(feedImage)}</url><title>${xmlEscape(feedTitle)}</title><link>${xmlEscape(siteUrl)}</link></image>` : '',
    ...items,
    '  </channel>',
    '</rss>',
    ''
  ].filter(line => line !== '').join('\n');
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

function createHomeMarkdown(settings, homepageText, posts, categories = []) {
  const postLines = posts.map(post => (
    `- [${markdownEscape(post.title)}](${absoluteUrl(settings, pagePathForPost(post)) || pagePathForPost(post)}): ${post.description || post.categoryName || 'Blog post'}`
  ));
  const categoryLines = categories.map(category => (
    `- [${markdownEscape(category.name)}](${category.absoluteUrl || categoryPathForCategory(category)}): ${category.description || `${category.postCount} posts`}`
  ));
  return [
    `# ${homepageText.siteName}`,
    '',
    `> ${settings.seoDescription || homepageText.siteSubtitle || 'Static blog archive.'}`,
    '',
    `Author: ${homepageText.authorName}`,
    `Language: ${SUPPORTED_LOCALES[settings.locale]} (${settings.locale})`,
    '',
    '## Categories',
    ...(categoryLines.length ? categoryLines : ['No categories configured.']),
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
    `Category: ${post.categoryName}`,
    `Tags: ${(post.tags || []).join(', ') || 'None'}`,
    '',
    post.rawContent || '',
    ''
  ].join('\n');
}

function createCategoryMarkdown(settings, homepageText, category, posts) {
  const postLines = posts.map(post => (
    `- [${markdownEscape(post.title)}](${absoluteUrl(settings, pagePathForPost(post)) || pagePathForPost(post)}): ${post.description || 'Blog post'}`
  ));
  return [
    `# ${category.name}`,
    '',
    `> ${category.description || `${translateText('Category Archive', settings.locale)}: ${category.name}`}`,
    '',
    `Canonical URL: ${absoluteUrl(settings, categoryPathForCategory(category)) || categoryPathForCategory(category)}`,
    `Site: ${homepageText.siteName}`,
    `Language: ${SUPPORTED_LOCALES[settings.locale]} (${settings.locale})`,
    '',
    '## Posts',
    ...(postLines.length ? postLines : ['No published posts in this category.']),
    ''
  ].join('\n');
}

function createLlmsTxt(settings, homepageText, posts, categories = []) {
  const postLines = posts.map(post => {
    const markdownUrl = absoluteUrl(settings, markdownPathForPost(post)) || markdownPathForPost(post);
    return `- [${markdownEscape(post.title)}](${markdownUrl}): ${post.description || `${post.categoryName} post`}`;
  });
  const categoryLines = categories.map(category => {
    const markdownUrl = absoluteUrl(settings, categoryMarkdownPath(category)) || categoryMarkdownPath(category);
    return `- [${markdownEscape(category.name)}](${markdownUrl}): ${category.description || `${category.postCount} posts`}`;
  });
  const optional = [
    `- [Sitemap](${absoluteUrl(settings, '/sitemap.xml') || '/sitemap.xml'}): XML list of canonical public URLs`,
    settings.features.rss ? `- [RSS feed](${absoluteUrl(settings, '/feed.xml') || '/feed.xml'}): XML feed of published posts for readers and aggregators` : '',
    settings.features.search ? `- [Search index](${absoluteUrl(settings, '/search.json') || '/search.json'}): Machine-readable post metadata used by the public search UI` : '',
    `- [Full LLM context](${absoluteUrl(settings, '/llms-full.txt') || '/llms-full.txt'}): Plain Markdown bundle of the public archive`
  ].filter(Boolean);

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
    '## Categories',
    ...(categoryLines.length ? categoryLines : ['No category archive pages.']),
    '',
    '## Optional',
    ...optional,
    ''
  ].join('\n');
}

function createLlmsFullTxt(settings, homepageText, posts, categories = []) {
  return [
    createLlmsTxt(settings, homepageText, posts, categories),
    '---',
    '',
    ...categories.flatMap(category => [
      createCategoryMarkdown(settings, homepageText, category, posts.filter(post => post.categorySlug === category.slug)),
      '---',
      ''
    ]),
    ...posts.flatMap(post => [
      createPostMarkdown(settings, homepageText, post),
      '---',
      ''
    ])
  ].join('\n');
}

function createDynamicVariables(settings, posts = [], currentPost = null, now = new Date(), currentCategory = null, categories = []) {
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
    categoryCount: String(categories.length),
    categories: categories.map(category => category.name).join(', '),
    category: currentCategory?.name || currentPost?.categoryName || '',
    categoryName: currentCategory?.name || currentPost?.categoryName || '',
    categorySlug: currentCategory?.slug || currentPost?.categorySlug || '',
    categoryDescription: currentCategory?.description || currentPost?.categoryDescription || '',
    categoryUrl: currentCategory ? categoryPathForCategory(currentCategory) : (currentPost?.categoryUrl || ''),
    lastPost: latestUrl,
    lastPostUrl: latestUrl,
    lastPostSlug: latestPost?.slug || '',
    lastPostTitle: latestPost?.title || '',
    lastPostDescription: latestPost?.description || '',
    lastPostDate: latestPost ? formatDateForLocale(latestPost.date, locale) : '',
    lastPostIsoDate: latestPost?.date || '',
    lastPostCategory: latestPost?.categoryName || '',
    lastPostCategoryUrl: latestPost?.categoryUrl || '',
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
    postCategory: currentPost?.categoryName || '',
    postCategoryUrl: currentPost?.categoryUrl || '',
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
    metaTag('google-analytics-id', pageMeta.googleAnalyticsId),
    pageMeta.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(pageMeta.canonicalUrl)}">` : '',
    pageMeta.markdownUrl ? `<link rel="alternate" type="text/markdown" href="${escapeHtml(pageMeta.markdownUrl)}">` : '',
    pageMeta.feedUrl ? `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(pageMeta.feedTitle || `${pageMeta.siteName || 'ZenithPress'} RSS Feed`)}" href="${escapeHtml(pageMeta.feedUrl)}">` : '',
    pageMeta.googleAnalyticsId ? '<link rel="stylesheet" href="/consent.css">' : '',
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

function formatCategoryLinkLabel(category, options = {}) {
  const name = String(category?.name || category?.categoryName || 'Uncategorized');
  const label = options.upper ? name.toUpperCase() : name;
  return `${options.prefix || ''}${label}${options.suffix || ''}`;
}

function renderCategoryLink(settings, post, options = {}) {
  const label = escapeHtml(formatCategoryLinkLabel({
    name: post?.categoryName || post?.category || 'Uncategorized'
  }, options));
  const className = escapeHtml(options.className || 'post-category');
  const style = post?.categoryColor ? ` style="--category-color: ${escapeHtml(post.categoryColor)}"` : '';
  if (settings.features.categories && post?.categoryUrl) {
    return `<a href="${escapeHtml(post.categoryUrl)}" class="${className}"${style}>${label}</a>`;
  }
  return `<span class="${className}"${style}>${label}</span>`;
}

function renderCategoryNav(settings, categories = [], currentCategory = null, options = {}) {
  if (!settings.features.categories || !categories.length) return '';
  const totalPosts = categories.reduce((sum, category) => sum + (Number(category.postCount) || 0), 0);
  const activeSlug = currentCategory?.categorySlug || currentCategory?.slug || '';
  const title = escapeHtml(`${options.titlePrefix || ''}${translateText('Categories', settings.locale)}`);
  const className = escapeHtml(options.className || 'widget widget-categories');
  const titleClass = escapeHtml(options.titleClass || 'widget-title');
  const allPostsLabel = escapeHtml(translateText('All Posts', settings.locale));
  const allActiveClass = activeSlug ? '' : ' active';
  const items = [
    `<a class="category-chip${allActiveClass}" href="/index.html"><span class="category-color" style="--category-color: #64748b"></span><span class="category-name">${allPostsLabel}</span><span class="category-count">${totalPosts}</span></a>`,
    ...categories.map(category => {
      const activeClass = activeSlug === category.slug ? ' active' : '';
      return `<a class="category-chip${activeClass}" href="${escapeHtml(category.url)}" style="--category-color: ${escapeHtml(category.color)}"><span class="category-color"></span><span class="category-name">${escapeHtml(category.name)}</span><span class="category-count">${Number(category.postCount) || 0}</span></a>`;
    })
  ];
  return [
    `<nav class="${className}" aria-label="${escapeHtml(translateText('Categories', settings.locale))}">`,
    `  <h3 class="${titleClass}">${title}</h3>`,
    '  <div class="category-list">',
    ...items.map(item => `    ${item}`),
    '  </div>',
    '</nav>'
  ].join('\n');
}

function renderCategoryArchiveHeader(settings, currentCategory = null) {
  if (!settings.features.categories || !currentCategory) return '';
  const description = currentCategory.description
    ? `<p class="category-archive-description">${escapeHtml(currentCategory.description)}</p>`
    : '';
  return [
    `<section class="category-archive-intro" style="--category-color: ${escapeHtml(currentCategory.color)}">`,
    `  <p class="category-archive-kicker">${escapeHtml(translateText('Category Archive', settings.locale))}</p>`,
    `  <h2 class="category-archive-title">${escapeHtml(currentCategory.name)}</h2>`,
    description,
    `  <a class="category-archive-back" href="/index.html">${escapeHtml(translateText('All Posts', settings.locale))}</a>`,
    '</section>'
  ].filter(Boolean).join('\n');
}

function renderConsentDialog(settings) {
  if (!isAnalyticsConfigured(settings)) return '';
  const titleId = 'analytics-consent-title';
  return [
    '<button class="consent-preferences-button" type="button" data-open-consent hidden>',
    `  ${escapeHtml(translateText('Privacy preferences', settings.locale))}`,
    '</button>',
    '<div class="consent-backdrop" data-consent-backdrop hidden></div>',
    '<section class="consent-modal" data-consent-modal role="dialog" aria-modal="false" aria-hidden="true" aria-labelledby="analytics-consent-title" hidden>',
    '  <div class="consent-modal__panel">',
    `    <h2 id="${titleId}">${escapeHtml(translateText('Analytics preferences', settings.locale))}</h2>`,
    `    <p class="consent-modal__copy">${escapeHtml(translateText('We use Google Analytics in a privacy-first mode to understand aggregate traffic, popular links, and page performance.', settings.locale))}</p>`,
    `    <p class="consent-modal__note">${escapeHtml(translateText('Reject optional keeps the site fully functional without analytics cookies. Google may still receive cookieless, aggregate measurement signals. You can change this later from Privacy preferences.', settings.locale))}</p>`,
    '    <div class="consent-modal__actions">',
    `      <button class="consent-button consent-button--ghost" type="button" data-consent-action="decline">${escapeHtml(translateText('Reject optional', settings.locale))}</button>`,
    `      <button class="consent-button consent-button--solid" type="button" data-consent-action="accept">${escapeHtml(translateText('Accept optional', settings.locale))}</button>`,
    '    </div>',
    '  </div>',
    '</section>',
    '<script src="/consent.js" defer></script>'
  ].join('\n');
}

function createTemplateHelpers(settings, variables) {
  return {
    upper: value => String(value || '').toUpperCase(),
    t: value => resolveTemplateVariables(translateText(value, settings.locale), variables),
    copy: (key, fallback = '') => resolveThemeTextCopy(settings, key, fallback, variables),
    date: value => formatDateForLocale(value, settings.locale),
    isoDate: value => toIsoDate(value),
    seoHead: pageMeta => renderSeoHead({
      ...pageMeta,
      siteName: settings.siteName,
      googleAnalyticsId: settings.analytics?.googleMeasurementId || ''
    }),
    longDate: value => formatDateForLocale(value, settings.locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    categoryLink: (post, options = {}) => renderCategoryLink(settings, post, options),
    categoryNav: (categories = [], currentCategory = null, options = {}) => renderCategoryNav(settings, categories, currentCategory, options),
    categoryArchiveHeader: currentCategory => renderCategoryArchiveHeader(settings, currentCategory),
    consentDialog: () => renderConsentDialog(settings)
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

function normalizeFeatureFlags(features = {}) {
  return {
    search: features.search !== false,
    newsletter: features.newsletter !== false,
    about: features.about !== false,
    rss: features.rss !== false,
    categories: features.categories !== false
  };
}

function filterWidgetsForFeatures(widgets, features) {
  return widgets.filter(widget => {
    if (widget.type === 'newsletter' && features.newsletter === false) return false;
    if (widget.type === 'bio' && features.about === false) return false;
    return true;
  });
}

function normalizeSettings(settings = {}) {
  const widgets = Array.isArray(settings.widgets) ? settings.widgets.map(normalizeWidget) : [];
  const categories = normalizeCategories(settings.categories);
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
    features: normalizeFeatureFlags(settings.features),
    categories,
    analytics: normalizeAnalyticsSettings(settings.analytics),
    themeText: normalizeThemeText(settings.themeText),
    widgets
  };
}

function readSettings(site = getSiteContext(MAIN_SITE_ID)) {
  ensureSiteDirectories(site);
  return normalizeSettings(JSON.parse(fs.readFileSync(site.settingsFile, 'utf-8')));
}

function normalizePost(attributes = {}, body = '', fileName = '', categories = DEFAULT_CATEGORIES) {
  const fileSlug = slugify(path.basename(fileName, path.extname(fileName)));
  const title = String(attributes.title || 'Untitled Post');
  const slug = slugify(attributes.slug || fileSlug || title);
  return {
    title,
    slug: isValidSlug(slug) ? slug : fileSlug || slugify(title) || 'untitled-post',
    description: String(attributes.description || ''),
    date: String(attributes.date || new Date().toISOString().split('T')[0]),
    category: normalizePostCategory(attributes.category, categories),
    tags: normalizeTags(attributes.tags),
    coverImage: String(attributes.coverImage || ''),
    draft: attributes.draft === true,
    content: String(body || ''),
    readingTime: calculateReadingTime(body),
    wordCount: countWords(body),
    fileName
  };
}

function normalizePostPayload(body = {}, settings = readSettings()) {
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
    category: normalizePostCategory(body.category, settings.categories, { strict: true }),
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
    `category: ${JSON.stringify(post.categorySlug || post.category)}`,
    `tags: ${JSON.stringify(post.tags)}`,
    `coverImage: ${JSON.stringify(post.coverImage)}`,
    `draft: ${post.draft === true}`,
    '---',
    '',
    post.content
  ].join('\n');
}

// Read and parse all posts
function getAllPosts(site = getSiteContext(MAIN_SITE_ID), includeDrafts = true, settings = readSettings(site)) {
  ensureSiteDirectories(site);
  if (!fs.existsSync(site.postsDir)) return [];
  const files = fs.readdirSync(site.postsDir);
  const posts = files
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const filePath = path.join(site.postsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);
      const parsed = fm(content);
      
      return {
        ...decoratePostCategory(normalizePost(parsed.attributes, parsed.body, file, settings.categories), settings.categories),
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

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

// Fetch configured websites
app.get('/api/sites', (req, res) => {
  try {
    const registry = readSiteRegistry();
    const sites = registry.sites.map(site => {
      const context = getSiteContext(site.id);
      ensureSiteDirectories(context);
      const settings = readSettings(context);
      const postCount = getAllPosts(context, true, settings).length;
      return {
        ...site,
        siteName: settings.siteName,
        postCount,
        previewUrl: site.id === MAIN_SITE_ID ? '/' : `/preview/${site.id}/`
      };
    });
    res.json({ activeSiteId: registry.activeSiteId, sites });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to read websites.' });
  }
});

// Create a new website workspace
app.post('/api/sites', (req, res) => {
  try {
    const name = normalizeSiteName(req.body.name, 'New Website');
    const id = normalizeSiteId(req.body.id || name);
    if (id === MAIN_SITE_ID) {
      return res.status(400).json({ error: 'The main website already exists.' });
    }

    const registry = readSiteRegistry();
    if (registry.sites.some(site => site.id === id)) {
      return res.status(400).json({ error: 'A website with this ID already exists.' });
    }

    const now = new Date().toISOString();
    const siteRecord = normalizeSiteRecord({
      id,
      name,
      deploy: req.body.deploy || {},
      createdAt: now,
      updatedAt: now
    });
    const context = getSiteContext(id);
    ensureSiteDirectories(context);
    const settings = createDefaultSettings({
      siteName: name,
      siteSubtitle: '',
      authorName: '',
      authorBio: '',
      siteUrl: ''
    });
    fs.writeFileSync(context.settingsFile, JSON.stringify(normalizeSettings(settings), null, 2), 'utf-8');

    registry.sites.push(siteRecord);
    registry.activeSiteId = id;
    writeSiteRegistry(registry);
    res.json({ success: true, site: siteRecord });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to create website.' });
  }
});

// Update website metadata and deployment defaults
app.put('/api/sites/:siteId', (req, res) => {
  try {
    const id = normalizeSiteId(req.params.siteId);
    const registry = readSiteRegistry();
    const siteIndex = registry.sites.findIndex(site => site.id === id);
    if (siteIndex === -1) {
      return res.status(404).json({ error: 'Website not found.' });
    }
    const existing = registry.sites[siteIndex];
    const updated = normalizeSiteRecord({
      ...existing,
      name: req.body.name === undefined ? existing.name : req.body.name,
      deploy: req.body.deploy === undefined ? existing.deploy : req.body.deploy,
      updatedAt: new Date().toISOString()
    });
    registry.sites[siteIndex] = updated;
    registry.activeSiteId = req.body.makeActive === false ? registry.activeSiteId : id;
    writeSiteRegistry(registry);
    res.json({ success: true, site: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to update website.' });
  }
});

// Fetch settings
app.get('/api/settings', (req, res) => {
  try {
    const site = getSiteContextFromRequest(req);
    res.json(readSettings(site));
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to read settings configuration.' });
  }
});

// Update settings
app.post('/api/settings', (req, res) => {
  try {
    const site = getSiteContextFromRequest(req);
    const settings = normalizeSettings(req.body);
    fs.writeFileSync(site.settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
    res.json({ success: true, message: 'Settings saved successfully.', settings });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to write settings configuration.' });
  }
});

// Fetch all posts (for admin view)
app.get('/api/posts', (req, res) => {
  try {
    const site = getSiteContextFromRequest(req);
    const settings = readSettings(site);
    const posts = getAllPosts(site, true, settings);
    res.json(posts);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to fetch posts.' });
  }
});

// Fetch a single post
app.get('/api/posts/:slug', (req, res) => {
  try {
    const site = getSiteContextFromRequest(req);
    const { slug } = req.params;
    const filePath = postFilePath(site, slug);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = fm(content);
    const settings = readSettings(site);
    const post = decoratePostCategory(normalizePost(parsed.attributes, parsed.body, `${slug}.md`, settings.categories), settings.categories);
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
    const site = getSiteContextFromRequest(req);
    const settings = readSettings(site);
    const post = normalizePostPayload(req.body, settings);
    const filePath = postFilePath(site, post.slug);
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
    const site = getSiteContextFromRequest(req);
    const settings = readSettings(site);
    const oldSlug = req.params.slug;
    assertValidSlug(oldSlug);
    const post = normalizePostPayload(req.body, settings);
    const oldFilePath = postFilePath(site, oldSlug);
    const newFilePath = postFilePath(site, post.slug);

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
    const site = getSiteContextFromRequest(req);
    const { slug } = req.params;
    const filePath = postFilePath(site, slug);
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
    const site = getSiteContextFromRequest(req);
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
    const targetPath = resolveInside(site.imagesDir, uniqueName);
    
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
    const site = getSiteContextFromRequest(req);
    logMsg("Starting static compilation pipeline...");
    logMsg(`Website workspace: "${site.record.name}" (${site.id}).`);

    // 1. Read settings and verified templates
    const settings = readSettings(site);
    const templateName = settings.selectedTemplate || 'nordic-minimal';
    const activeTemplateDir = resolveInside(TEMPLATES_DIR, templateName);
    
    logMsg(`Selected template structure: "${templateName}"`);

    if (!fs.existsSync(activeTemplateDir)) {
      throw new Error(`Template directory not found: ${templateName}`);
    }

    // 2. Refresh output folder
    if (fs.existsSync(site.outDir)) {
      // Clear out older files, keeping .git if present to maintain history
      const files = fs.readdirSync(site.outDir);
      files.forEach(f => {
        if (f !== '.git') {
          fs.rmSync(path.join(site.outDir, f), { recursive: true, force: true });
        }
      });
      logMsg(`Output directory ${path.relative(__dirname, site.outDir) || 'out'} cleaned.`);
    } else {
      fs.mkdirSync(site.outDir, { recursive: true });
      logMsg(`Created output directory ${path.relative(__dirname, site.outDir) || 'out'}.`);
    }

    // 3. Read posts (excl drafts for compilation)
    const posts = getAllPosts(site, false, settings);
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
    const visibleWidgets = filterWidgetsForFeatures(settings.widgets, settings.features);
    const categorySummaries = settings.features.categories
      ? buildCategorySummaries(settings.categories, compiledPosts, settings)
      : [];

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
    const homepageVariables = createDynamicVariables(settings, compiledPosts, null, publishNow, null, categorySummaries);
    const homepageText = resolveSettingsText(settings, homepageVariables);
    const homepageMeta = createHomePageMeta(settings, homepageText, compiledPosts, categorySummaries);
    
    const homepageData = {
      siteName: homepageText.siteName,
      siteSubtitle: homepageText.siteSubtitle,
      authorName: homepageText.authorName,
      authorBio: homepageText.authorBio,
      authorAvatar: settings.authorAvatar,
      socialLinks: settings.socialLinks,
      locale: settings.locale,
      features: settings.features,
      categories: categorySummaries,
      currentCategory: null,
      themeText: settings.themeText,
      widgets: resolveWidgets(visibleWidgets, homepageVariables, settings.locale),
      helpers: createTemplateHelpers(settings, homepageVariables),
      pageMeta: homepageMeta,
      variables: homepageVariables,
      allPosts: compiledPosts,
      posts: compiledPosts
    };

    const homeHtml = renderTemplate(indexTemplate, homepageData, `${templateName}/index.ejs`);
    fs.writeFileSync(path.join(site.outDir, 'index.html'), homeHtml, 'utf-8');
    fs.writeFileSync(path.join(site.outDir, 'index.html.md'), createHomeMarkdown(settings, homepageText, compiledPosts, categorySummaries), 'utf-8');
    logMsg("Home page successfully written.");

    // 7. Build individual post pages under out/posts/[slug]/index.html for clean URLs
    const postsOutDir = path.join(site.outDir, 'posts');
    if (!fs.existsSync(postsOutDir)) {
      fs.mkdirSync(postsOutDir, { recursive: true });
    }

    for (const post of compiledPosts) {
      logMsg(`Compiling article page: "/posts/${post.slug}"...`);
      const singlePostDir = postOutputDir(site, post.slug);
      if (!fs.existsSync(singlePostDir)) {
        fs.mkdirSync(singlePostDir, { recursive: true });
      }
      const singlePostVariables = createDynamicVariables(settings, compiledPosts, post, publishNow, null, categorySummaries);
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
        features: settings.features,
        categories: categorySummaries,
        currentCategory: null,
        themeText: settings.themeText,
        widgets: resolveWidgets(visibleWidgets, singlePostVariables, settings.locale),
        helpers: createTemplateHelpers(settings, singlePostVariables),
        pageMeta: singlePostMeta,
        variables: singlePostVariables,
        allPosts: compiledPosts,
        posts: compiledPosts,
        post: post
      };

      const postHtml = renderTemplate(postTemplate, singlePostData, `${templateName}/post.ejs`, { requirePost: true });
      fs.writeFileSync(path.join(singlePostDir, 'index.html'), postHtml, 'utf-8');
      fs.writeFileSync(path.join(singlePostDir, 'index.html.md'), createPostMarkdown(settings, singlePostText, post), 'utf-8');
    }
    logMsg(`All ${compiledPosts.length} posts compiled successfully.`);

    if (settings.features.categories) {
      const categoriesOutDir = path.join(site.outDir, 'categories');
      fs.mkdirSync(categoriesOutDir, { recursive: true });
      for (const category of categorySummaries) {
        const categoryPosts = compiledPosts.filter(post => post.categorySlug === category.slug);
        logMsg(`Compiling category archive: "/categories/${category.slug}" (${categoryPosts.length} posts)...`);
        const singleCategoryDir = categoryOutputDir(site, category.slug);
        fs.mkdirSync(singleCategoryDir, { recursive: true });
        const categoryVariables = createDynamicVariables(settings, categoryPosts, null, publishNow, category, categorySummaries);
        const categoryText = resolveSettingsText(settings, categoryVariables);
        const categoryMeta = createCategoryPageMeta(settings, categoryText, category, categoryPosts);
        const categoryData = {
          siteName: categoryText.siteName,
          siteSubtitle: categoryText.siteSubtitle,
          authorName: categoryText.authorName,
          authorBio: categoryText.authorBio,
          authorAvatar: settings.authorAvatar,
          socialLinks: settings.socialLinks,
          locale: settings.locale,
          features: settings.features,
          categories: categorySummaries,
          currentCategory: category,
          themeText: settings.themeText,
          widgets: resolveWidgets(visibleWidgets, categoryVariables, settings.locale),
          helpers: createTemplateHelpers(settings, categoryVariables),
          pageMeta: categoryMeta,
          variables: categoryVariables,
          allPosts: compiledPosts,
          posts: categoryPosts
        };

        const categoryHtml = renderTemplate(indexTemplate, categoryData, `${templateName}/index.ejs`);
        fs.writeFileSync(path.join(singleCategoryDir, 'index.html'), categoryHtml, 'utf-8');
        fs.writeFileSync(path.join(singleCategoryDir, 'index.html.md'), createCategoryMarkdown(settings, categoryText, category, categoryPosts), 'utf-8');
      }
      logMsg(`All ${categorySummaries.length} category archives compiled successfully.`);
    } else {
      logMsg("Category archives disabled; skipped /categories output.");
    }

    // 8. Copy active template stylesheets and client assets
    const styleSrc = path.join(activeTemplateDir, 'style.css');
    if (fs.existsSync(styleSrc)) {
      fs.copyFileSync(styleSrc, path.join(site.outDir, 'style.css'));
      logMsg("Copied template stylesheet (style.css).");
    }

    const scriptSrc = path.join(activeTemplateDir, 'script.js');
    if (fs.existsSync(scriptSrc)) {
      fs.copyFileSync(scriptSrc, path.join(site.outDir, 'script.js'));
      logMsg("Copied template script asset (script.js).");
    }

    if (settings.features.search && fs.existsSync(COMMON_SEARCH_SCRIPT)) {
      fs.copyFileSync(COMMON_SEARCH_SCRIPT, path.join(site.outDir, 'search.js'));
      logMsg("Copied shared search script (search.js).");
    }

    if (settings.features.search && fs.existsSync(COMMON_SEARCH_STYLE)) {
      fs.copyFileSync(COMMON_SEARCH_STYLE, path.join(site.outDir, 'search.css'));
      logMsg("Copied shared search stylesheet (search.css).");
    }

    if (settings.features.categories && fs.existsSync(COMMON_TAXONOMY_STYLE)) {
      fs.copyFileSync(COMMON_TAXONOMY_STYLE, path.join(site.outDir, 'taxonomy.css'));
      logMsg("Copied shared taxonomy stylesheet (taxonomy.css).");
    }

    if (isAnalyticsConfigured(settings)) {
      if (fs.existsSync(COMMON_CONSENT_SCRIPT)) {
        fs.copyFileSync(COMMON_CONSENT_SCRIPT, path.join(site.outDir, 'consent.js'));
        logMsg("Copied analytics consent script (consent.js).");
      }
      if (fs.existsSync(COMMON_CONSENT_STYLE)) {
        fs.copyFileSync(COMMON_CONSENT_STYLE, path.join(site.outDir, 'consent.css'));
        logMsg("Copied analytics consent stylesheet (consent.css).");
      }
    } else {
      logMsg("Google Analytics not configured; skipped consent assets.");
    }

    if (fs.existsSync(FAVICON_SOURCE)) {
      fs.copyFileSync(FAVICON_SOURCE, path.join(site.outDir, 'favicon.svg'));
      logMsg("Copied favicon asset (favicon.svg).");
    }

    // 9. Copy uploaded images
    const imagesOutDir = path.join(site.outDir, 'content', 'images');
    if (fs.existsSync(site.imagesDir)) {
      fs.mkdirSync(imagesOutDir, { recursive: true });
      const imageFiles = fs.readdirSync(site.imagesDir);
      imageFiles.forEach(file => {
        fs.copyFileSync(path.join(site.imagesDir, file), path.join(imagesOutDir, file));
      });
      logMsg(`Copied ${imageFiles.length} uploaded images to static assets.`);
    }

    // 10. Generate search JSON index
    if (settings.features.search) {
      logMsg("Building client-side search database (search.json)...");
      const searchIndex = compiledPosts.map(p => ({
        title: p.title,
        slug: p.slug,
        url: absoluteUrl(settings, pagePathForPost(p)) || pagePathForPost(p),
        markdownUrl: absoluteUrl(settings, markdownPathForPost(p)) || markdownPathForPost(p),
        category: p.categorySlug,
        categoryName: p.categoryName,
        categoryUrl: p.categoryUrl,
        description: p.description,
        date: p.date,
        dateModified: p.modifiedAt || toIsoDate(p.date),
        formattedDate: formatDateForLocale(p.date, settings.locale),
        readingTime: p.readingTime,
        wordCount: p.wordCount,
        tags: p.tags
      }));
      fs.writeFileSync(path.join(site.outDir, 'search.json'), JSON.stringify(searchIndex, null, 2), 'utf-8');
      logMsg("Search database written.");
    } else {
      logMsg("Search feature disabled; skipped search assets and index.");
    }

    fs.writeFileSync(path.join(site.outDir, 'sitemap.xml'), createSitemapXml(settings, compiledPosts, categorySummaries, publishNow), 'utf-8');
    if (settings.features.rss) {
      fs.writeFileSync(path.join(site.outDir, 'feed.xml'), createRssFeedXml(settings, homepageText, compiledPosts, publishNow), 'utf-8');
      logMsg("RSS feed written (feed.xml).");
    } else {
      logMsg("RSS feed disabled; skipped feed.xml.");
    }
    fs.writeFileSync(path.join(site.outDir, 'robots.txt'), createRobotsTxt(settings), 'utf-8');
    fs.writeFileSync(path.join(site.outDir, 'llms.txt'), createLlmsTxt(settings, homepageText, compiledPosts, categorySummaries), 'utf-8');
    fs.writeFileSync(path.join(site.outDir, 'llms-full.txt'), createLlmsFullTxt(settings, homepageText, compiledPosts, categorySummaries), 'utf-8');
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
  const log = [];
  const logMsg = (msg) => { log.push(`[DEPLOY] ${msg}`); console.log(`[DEPLOY] ${msg}`); };

  try {
    const site = getSiteContextFromRequest(req);
    const deployInput = {
      ...site.record.deploy,
      ...req.body
    };
    const safeRemoteUrl = validateRemoteUrl(deployInput.remoteUrl);
    const safeBranch = validateBranch(deployInput.branch || DEFAULT_DEPLOY_SETTINGS.branch);
    const safeCommitMessage = validateCommitMessage(deployInput.commitMessage || DEFAULT_DEPLOY_SETTINGS.commitMessage);
    const registryUpdate = readSiteRegistry();
    const siteIndex = registryUpdate.sites.findIndex(record => record.id === site.id);
    if (siteIndex !== -1) {
      registryUpdate.sites[siteIndex] = {
        ...registryUpdate.sites[siteIndex],
        deploy: {
          remoteUrl: safeRemoteUrl,
          branch: safeBranch,
          commitMessage: safeCommitMessage
        },
        updatedAt: new Date().toISOString()
      };
      registryUpdate.activeSiteId = site.id;
      writeSiteRegistry(registryUpdate);
    }
    logMsg(`Starting Git Deployment pipeline for "${site.record.name}" on branch "${safeBranch}"...`);

    // Ensure out directory exists
    if (!fs.existsSync(site.outDir) || fs.readdirSync(site.outDir).length <= 1) {
      throw new Error("No static files compiled yet. Run static compilation first.");
    }

    // Check if Git is initialized in out/
    const isGitRepo = fs.existsSync(path.join(site.outDir, '.git'));
    if (!isGitRepo) {
      logMsg(`Initializing new local Git workspace inside ${path.relative(__dirname, site.outDir) || 'out'}...`);
      await runCommand('git', ['init'], site.outDir);
      await runCommand('git', ['remote', 'add', 'origin', safeRemoteUrl], site.outDir);
      logMsg("Workspace successfully initialized with remote target.");
    } else {
      // Update remote just in case it changed
      try {
        await runCommand('git', ['remote', 'set-url', 'origin', safeRemoteUrl], site.outDir);
      } catch (err) {
        // If set-url fails because origin doesn't exist
        await runCommand('git', ['remote', 'add', 'origin', safeRemoteUrl], site.outDir);
      }
    }

    // Configure credentials locally inside the subfolder so we don't interfere with global configs
    logMsg("Configuring local directory git targets...");
    await runCommand('git', ['config', 'user.name', 'ZenithPress Compiler'], site.outDir);
    await runCommand('git', ['config', 'user.email', 'compiler@zenithpress.local'], site.outDir);

    // Checkout deployment branch
    try {
      logMsg(`Checking out branch: "${safeBranch}"...`);
      await runCommand('git', ['checkout', '-B', safeBranch], site.outDir);
    } catch (err) {
      // If branch checkout fails, create it
      await runCommand('git', ['checkout', '-b', safeBranch], site.outDir);
    }

    // Add and commit files
    logMsg("Staging files...");
    await runCommand('git', ['add', '.'], site.outDir);

    // Check git status to see if anything changed
    const status = await runCommand('git', ['status', '--porcelain'], site.outDir);
    if (!status.trim()) {
      logMsg("No changes detected since last publication.");
      return res.json({ success: true, message: "Static pages are already up-to-date.", log });
    }

    logMsg(`Committing updates: "${safeCommitMessage}"...`);
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const finalMsg = `${safeCommitMessage} (${dateStr})`;
    await runCommand('git', ['commit', '-m', finalMsg], site.outDir);

    // Push to GitHub
    logMsg(`Pushing assets to origin/${safeBranch}...`);
    // Using --force to guarantee hosting files replace whatever is currently in gh-pages
    await runCommand('git', ['push', 'origin', safeBranch, '--force'], site.outDir);

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
