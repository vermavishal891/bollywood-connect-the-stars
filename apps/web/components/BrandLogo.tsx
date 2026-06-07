type BrandLogoVariant = 'primary' | 'gold' | 'neon' | 'icon' | 'mark' | 'footer';

const brandLogoSources: Record<BrandLogoVariant, string> = {
  primary: '/brand/04_web_navbar_footer/primary_holographic_star_reel_web_640px.png',
  gold: '/brand/04_web_navbar_footer/golden_star_connected_nodes_web_640px.png',
  neon: '/brand/04_web_navbar_footer/neon_glamour_primary_web_640px.png',
  icon: '/brand/03_app_icons/golden_star_connected_nodes_icon_192x192.png',
  mark: '/brand/03_app_icons/primary_holographic_star_reel_icon_192x192.png',
  footer: '/brand/04_web_navbar_footer/primary_holographic_star_reel_web_480px.png',
};

export default function BrandLogo({
  variant = 'primary',
  className = '',
  imageClassName = '',
  showWordmark = false,
  wordmarkClassName = '',
}: {
  variant?: BrandLogoVariant;
  className?: string;
  imageClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center justify-center gap-2.5 ${className}`}>
      <span className="logo-tile inline-flex shrink-0 items-center justify-center overflow-hidden">
        <img
          src={brandLogoSources[variant]}
          alt=""
          aria-hidden="true"
          className={`block object-contain ${imageClassName}`}
        />
      </span>
      {showWordmark && (
        <span className={`block min-w-0 leading-none ${wordmarkClassName}`}>
          <span className="block truncate font-display text-[1.05rem] font-bold text-cinema-gold-light">
            Bollywood
          </span>
          <span className="block truncate text-[0.68rem] font-black uppercase tracking-[0.26em] text-cinema-gold">
            Connect
          </span>
        </span>
      )}
      <span className="sr-only">Bollywood Connect</span>
    </span>
  );
}
