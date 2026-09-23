// Line icons (Lucide shapes, ISC) plus Claude's spark mark.

function Icon({ children, className = '' }) {
  return (
    <svg className={`i ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

export const PanelLeftIcon = () => (
  <Icon><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></Icon>
)
export const PlusIcon = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>
export const ChatIcon = () => <Icon><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></Icon>
export const FolderIcon = () => (
  <Icon><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></Icon>
)
export const LayersIcon = () => (
  <Icon>
    <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </Icon>
)
export const CodeXmlIcon = () => (
  <Icon><path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" /></Icon>
)
export const MenuIcon = () => <Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon>
export const GhostIcon = () => (
  <Icon>
    <path d="M9 10h.01" /><path d="M15 10h.01" />
    <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
  </Icon>
)
export const SlidersIcon = () => (
  <Icon><path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" /></Icon>
)
export const ClockIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
export const ChevronDownIcon = () => <Icon><path d="m6 9 6 6 6-6" /></Icon>
export const ArrowUpIcon = () => <Icon><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></Icon>
export const PencilIcon = () => (
  <Icon><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Icon>
)
export const GradCapIcon = () => (
  <Icon><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></Icon>
)
export const CodeIcon = () => <Icon><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></Icon>
export const CoffeeIcon = () => (
  <Icon>
    <path d="M10 2v2M14 2v2M6 2v2" />
    <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
  </Icon>
)
export const BulbIcon = () => (
  <Icon>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6M10 22h4" />
  </Icon>
)

// Irregular 12-ray starburst; same path as public/favicon.svg.
const SPARK_PATH =
  'M47.4 50L44.6 8.4A5.4 5.4 0 0 1 55.4 8.4L52.6 50ZM47.84 48.55L64.87 18.3A5.4 5.4 0 0 1 73.82 24.33L52.16 51.45ZM48.58 47.82L79.43 24.45A5.4 5.4 0 0 1 85.31 33.51L51.42 52.18ZM50.09 47.4L82.77 45.74A5.4 5.4 0 0 1 82.39 56.53L49.91 52.6ZM51.22 47.7L88.38 64.29A5.4 5.4 0 0 1 83.31 73.83L48.78 52.3ZM52.36 48.9L69.94 79.98A5.4 5.4 0 0 1 60.15 84.55L47.64 51.1ZM52.59 49.82L58.29 91.12A5.4 5.4 0 0 1 47.52 91.88L47.41 50.18ZM52.23 51.34L37.32 81.58A5.4 5.4 0 0 1 28.07 76.02L47.77 48.66ZM51.18 52.32L18.95 71.88A5.4 5.4 0 0 1 14.05 62.26L48.82 47.68ZM50.23 52.59L14.01 58.57A5.4 5.4 0 0 1 13.07 47.81L49.77 47.41ZM48.62 52.2L12.71 33.06A5.4 5.4 0 0 1 18.43 23.91L51.38 47.8ZM47.77 51.34L27.55 23.12A5.4 5.4 0 0 1 36.81 17.56L52.23 48.66Z'

export const Spark = ({ className }) => (
  <svg className={className} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
    <path d={SPARK_PATH} />
    <circle cx="50" cy="50" r="5.5" />
  </svg>
)
