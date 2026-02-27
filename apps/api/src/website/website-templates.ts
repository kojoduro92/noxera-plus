export type WebsiteBlock = {
  id: string;
  type:
    | 'hero'
    | 'cta_band'
    | 'feature_grid'
    | 'service_times'
    | 'staff_cards'
    | 'testimonials'
    | 'stats'
    | 'faq'
    | 'gallery'
    | 'map_contact'
    | 'footer'
    | 'dynamic_list'
    | 'form'
    | 'custom_fragment';
  settings: Record<string, unknown>;
};

export type WebsitePageTemplate = {
  slug: string;
  title: string;
  blocks: WebsiteBlock[];
  seo?: Record<string, unknown>;
};

export type WebsiteTemplateDefinition = {
  key: string;
  name: string;
  family: 'Corporate Ministry' | 'Community Growth' | 'Classic Church Modern';
  description: string;
  previewImageUrl: string;
  status: 'published' | 'draft';
  themeConfig: Record<string, unknown>;
  pages: WebsitePageTemplate[];
};

const PAGE_KIT_BASE: Omit<WebsitePageTemplate, 'blocks'>[] = [
  { slug: 'about', title: 'About' },
  { slug: 'service-times', title: 'Service Times' },
  { slug: 'ministries', title: 'Ministries & Groups' },
  { slug: 'events', title: 'Events' },
  { slug: 'sermons', title: 'Sermons' },
  { slug: 'new-here', title: 'New Here' },
  { slug: 'give', title: 'Give' },
  { slug: 'contact', title: 'Contact' },
  { slug: 'privacy', title: 'Privacy & Terms' },
];

const DEFAULT_SERVICE_TIMES = [
  { label: 'Sunday Worship', value: '8:00 AM, 10:30 AM' },
  { label: 'Wednesday Prayer', value: '6:30 PM' },
  { label: 'Youth Gathering', value: 'Friday 7:00 PM' },
];

const DEFAULT_FAQ_ITEMS = [
  { question: 'What should I wear?', answer: 'Come as you are. You are welcome here.' },
  { question: 'Do you have children programs?', answer: 'Yes. Kids check-in is open for every weekend service.' },
  { question: 'How long is a service?', answer: 'Most services run between 75 and 90 minutes.' },
];

function titleFromSlug(pageSlug: string) {
  return pageSlug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function pageKitBlocks(pageSlug: string): WebsiteBlock[] {
  switch (pageSlug) {
    case 'about':
      return [
        {
          id: 'about-hero',
          type: 'hero',
          settings: {
            eyebrow: 'Our Story',
            title: 'A church rooted in scripture and active in community.',
            subtitle: 'Discover our mission, beliefs, values, and leadership vision for the next generation.',
            primaryCtaLabel: 'Meet Our Team',
            primaryCtaHref: '/contact',
            secondaryCtaLabel: 'Join This Sunday',
            secondaryCtaHref: '/service-times',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1466442929976-97f336a657be?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'about-stats',
          type: 'stats',
          settings: {
            heading: 'Church at a glance',
            items: [
              { label: 'Years Serving City', value: '18' },
              { label: 'Active Members', value: '1,200+' },
              { label: 'Volunteer Teams', value: '22' },
              { label: 'Global Missions', value: '9' },
            ],
          },
        },
        {
          id: 'about-staff',
          type: 'staff_cards',
          settings: {
            heading: 'Leadership Team',
            items: [
              { name: 'Lead Pastor', role: 'Senior Pastor', bio: 'Vision and preaching leadership.' },
              { name: 'Executive Pastor', role: 'Operations Pastor', bio: 'Discipleship systems and care.' },
              { name: 'Worship Pastor', role: 'Creative Ministry', bio: 'Sunday experience and music teams.' },
            ],
          },
        },
      ];
    case 'service-times':
      return [
        {
          id: 'service-times-hero',
          type: 'hero',
          settings: {
            eyebrow: 'Plan Your Week',
            title: 'Find a service time that fits your family.',
            subtitle: 'We offer weekend and midweek gatherings with kids and youth environments.',
            primaryCtaLabel: 'Plan Your Visit',
            primaryCtaHref: '/new-here',
            secondaryCtaLabel: 'Contact Us',
            secondaryCtaHref: '/contact',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'service-times-list',
          type: 'service_times',
          settings: {
            heading: 'Gathering Schedule',
            items: DEFAULT_SERVICE_TIMES,
          },
        },
        {
          id: 'service-times-faq',
          type: 'faq',
          settings: {
            heading: 'First-time visitor questions',
            items: DEFAULT_FAQ_ITEMS,
          },
        },
      ];
    case 'ministries':
      return [
        {
          id: 'ministries-hero',
          type: 'hero',
          settings: {
            eyebrow: 'Ministries',
            title: 'Grow through groups, discipleship, and serving teams.',
            subtitle: 'Find the right ministry pathway for kids, students, adults, and families.',
            primaryCtaLabel: 'Join A Group',
            primaryCtaHref: '/contact',
            secondaryCtaLabel: 'See Events',
            secondaryCtaHref: '/events',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1529074963764-98f45c47344b?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'ministries-grid',
          type: 'feature_grid',
          settings: {
            heading: 'Ministry pathways',
            items: [
              { title: 'Kids', description: 'Safe and joyful Sunday learning environments.' },
              { title: 'Students', description: 'Mentorship, worship nights, and growth tracks.' },
              { title: 'Young Adults', description: 'Community-focused faith and leadership development.' },
              { title: 'Men', description: 'Brotherhood, accountability, and practical discipleship.' },
              { title: 'Women', description: 'Bible study, care circles, and ministry leadership.' },
              { title: 'Outreach', description: 'Serve local needs with compassion and excellence.' },
            ],
          },
        },
        {
          id: 'ministries-testimonials',
          type: 'testimonials',
          settings: {
            heading: 'Ministry impact stories',
            items: [
              { quote: 'Our family found real community through a weekly life group.', author: 'Church Family' },
              { quote: 'Serving helped me discover purpose and confidence.', author: 'Team Volunteer' },
            ],
          },
        },
      ];
    case 'events':
      return [
        {
          id: 'events-hero',
          type: 'hero',
          settings: {
            eyebrow: 'Calendar',
            title: 'Upcoming church events and gatherings.',
            subtitle: 'Track conferences, special services, team trainings, and community outreaches.',
            primaryCtaLabel: 'Register Interest',
            primaryCtaHref: '/contact',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1515165562835-c4c9a7d0b9e0?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'events-list',
          type: 'dynamic_list',
          settings: {
            source: 'events',
            heading: 'Upcoming Events',
            count: 6,
            fallback: {
              heading: 'Upcoming Events',
              body: 'No upcoming events right now. Check again soon.',
            },
          },
        },
      ];
    case 'sermons':
      return [
        {
          id: 'sermons-hero',
          type: 'hero',
          settings: {
            eyebrow: 'Messages',
            title: 'Watch and revisit biblical teaching each week.',
            subtitle: 'Browse the latest messages and share them with your family or group.',
            primaryCtaLabel: 'Watch Latest',
            primaryCtaHref: '/sermons',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'sermons-list',
          type: 'dynamic_list',
          settings: {
            source: 'sermons',
            heading: 'Latest Sermons',
            count: 9,
            fallback: {
              heading: 'Latest Sermons',
              body: 'Sermon content is being prepared.',
            },
          },
        },
        {
          id: 'sermons-embed',
          type: 'custom_fragment',
          settings: {
            html:
              '<div class="nx-media-card"><h3>Featured Message</h3><p>Embed your latest sermon video from YouTube or Vimeo.</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" loading="lazy" allowfullscreen title="Featured Sermon"></iframe></div>',
          },
        },
      ];
    case 'new-here':
      return [
        {
          id: 'new-here-hero',
          type: 'hero',
          settings: {
            eyebrow: 'Plan Your Visit',
            title: 'We are glad you are here.',
            subtitle: 'Find service times, parking details, and how to connect on your first visit.',
            primaryCtaLabel: 'Plan A Visit',
            primaryCtaHref: '/contact',
            secondaryCtaLabel: 'Service Times',
            secondaryCtaHref: '/service-times',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'new-here-grid',
          type: 'feature_grid',
          settings: {
            heading: 'What to expect',
            items: [
              { title: 'Friendly Welcome', description: 'Our host team helps you get settled quickly.' },
              { title: 'Kids Check-in', description: 'Secure and engaging children environments.' },
              { title: 'Clear Parking', description: 'Reserved first-time visitor parking on site.' },
            ],
          },
        },
        {
          id: 'new-here-form',
          type: 'form',
          settings: {
            formKey: 'new-here-connect',
            title: 'Let us welcome you',
            description: 'Share your details and our team will reach out.',
            submitLabel: 'Send Request',
          },
        },
      ];
    case 'give':
      return [
        {
          id: 'give-hero',
          type: 'hero',
          settings: {
            eyebrow: 'Generosity',
            title: 'Give securely and support ministry impact.',
            subtitle: 'Your generosity helps us serve families, support missions, and grow disciples.',
            primaryCtaLabel: 'Give Now',
            primaryCtaHref: '/give',
            secondaryCtaLabel: 'Contact Finance Team',
            secondaryCtaHref: '/contact',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1529078155058-5d716f45d604?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'give-stats',
          type: 'stats',
          settings: {
            heading: 'Where giving makes impact',
            items: [
              { label: 'Community Outreach', value: '35%' },
              { label: 'Missions', value: '25%' },
              { label: 'Discipleship', value: '30%' },
              { label: 'Care & Support', value: '10%' },
            ],
          },
        },
        {
          id: 'give-cta',
          type: 'dynamic_list',
          settings: {
            source: 'giving',
            heading: 'Recent Giving Activity',
            count: 5,
            fallback: {
              heading: 'Ways to Give',
              body: 'Online giving setup is in progress. Contact the church office for giving options.',
            },
          },
        },
      ];
    case 'contact':
      return [
        {
          id: 'contact-map',
          type: 'map_contact',
          settings: {
            heading: 'Find and Contact Us',
            address: '123 Community Road',
            email: 'hello@church.org',
            phone: '+1 (000) 000-0000',
            mapLink: 'https://maps.google.com',
          },
        },
        {
          id: 'contact-form',
          type: 'form',
          settings: {
            formKey: 'contact-us',
            title: 'Contact Our Team',
            description: 'We would love to hear from you.',
            submitLabel: 'Send Message',
          },
        },
        {
          id: 'contact-faq',
          type: 'faq',
          settings: {
            heading: 'Contact support',
            items: [
              { question: 'When do you respond?', answer: 'We usually respond within one business day.' },
              { question: 'Can I request prayer?', answer: 'Yes, use the contact form and select prayer support.' },
            ],
          },
        },
      ];
    case 'privacy':
      return [
        {
          id: 'privacy-hero',
          type: 'hero',
          settings: {
            eyebrow: 'Policy',
            title: 'Privacy and terms of use.',
            subtitle: 'Review how we collect, use, and protect your data when using this church website.',
            primaryCtaLabel: 'Contact Privacy Team',
            primaryCtaHref: '/contact',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1490129375591-2658b3e2ee50?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'privacy-content',
          type: 'custom_fragment',
          settings: {
            html:
              '<h2>Privacy Overview</h2><p>We respect your privacy and only collect information needed to serve your requests.</p><h3>What we collect</h3><ul><li>Contact details submitted through forms.</li><li>Engagement analytics for site improvements.</li></ul><h3>How data is used</h3><p>Information is used for church communication, member care, and operational reporting.</p><p><a href="/contact">Contact us</a> if you have questions about data handling.</p>',
          },
        },
      ];
    default:
      return [
        {
          id: `${pageSlug}-hero`,
          type: 'hero',
          settings: {
            eyebrow: pageSlug.replace(/-/g, ' ').toUpperCase(),
            title: titleFromSlug(pageSlug),
            subtitle: 'Edit this section with your own story and ministry details.',
            primaryCtaLabel: 'Learn More',
            primaryCtaHref: '/contact',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: `${pageSlug}-content`,
          type: 'feature_grid',
          settings: {
            heading: 'Highlights',
            items: [
              { title: 'People', description: 'Belong to a caring church community.' },
              { title: 'Purpose', description: 'Grow in faith through practical discipleship.' },
              { title: 'Mission', description: 'Serve the city with love and excellence.' },
            ],
          },
        },
      ];
  }
}

function withPageKit(homePage: WebsitePageTemplate): WebsitePageTemplate[] {
  const pages: WebsitePageTemplate[] = [homePage];
  for (const page of PAGE_KIT_BASE) {
    pages.push({
      slug: page.slug,
      title: page.title,
      blocks: pageKitBlocks(page.slug),
      seo: {
        title: `${page.title} | Church`,
        description: `Learn more about ${page.title.toLowerCase()} at our church.`,
        index: true,
        follow: true,
      },
    });
  }
  return pages;
}

export const WEBSITE_TEMPLATE_LIBRARY: WebsiteTemplateDefinition[] = [
  {
    key: 'civic-light',
    name: 'Civic Light',
    family: 'Corporate Ministry',
    description: 'Clean and corporate ministry layout with trust-focused messaging.',
    previewImageUrl: 'https://images.unsplash.com/photo-1466442929976-97f336a657be?auto=format&fit=crop&w=1400&q=80',
    status: 'published',
    themeConfig: {
      siteName: 'Civic Light Church',
      logoUrl: '/brand-logo.svg',
      contactLine: '684 West College St. Sun City, USA',
      navCtaLabel: 'Donate',
      navCtaHref: '/give',
      templateStyle: 'corporate-blue',
      layoutMode: 'full',
      customContentWidth: 1760,
      primaryColor: '#0b5fff',
      accentColor: '#06b6d4',
      font: 'inter',
      radiusScale: 'md',
      elevationScale: 'soft',
      spacingScale: 'balanced',
    },
    pages: withPageKit({
      slug: 'home',
      title: 'Home',
      seo: {
        title: 'Welcome to Our Church',
        description: 'Join us this weekend and grow in faith with a vibrant church community.',
        index: true,
        follow: true,
      },
      blocks: [
        {
          id: 'hero-home',
          type: 'hero',
          settings: {
            eyebrow: 'Sunday Services',
            title: 'Grow in faith with one church family.',
            subtitle: 'Service-time-first homepage with clear next steps for first-time visitors.',
            primaryCtaLabel: 'Plan Your Visit',
            primaryCtaHref: '/new-here',
            secondaryCtaLabel: 'Watch Live',
            secondaryCtaHref: '/sermons',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'services-home',
          type: 'service_times',
          settings: {
            heading: 'Weekly Service Times',
            items: DEFAULT_SERVICE_TIMES,
          },
        },
        {
          id: 'stats-home',
          type: 'stats',
          settings: {
            heading: 'Why people call this church home',
            items: [
              { label: 'Weekly Services', value: '4' },
              { label: 'Active Groups', value: '12' },
              { label: 'Volunteer Teams', value: '18' },
            ],
          },
        },
        {
          id: 'testimonials-home',
          type: 'testimonials',
          settings: {
            heading: 'Stories of growth',
            items: [
              { quote: 'Our family found support and purpose from week one.', author: 'Church Family' },
              { quote: 'The care team walked with us through a difficult season.', author: 'Member Testimony' },
            ],
          },
        },
        {
          id: 'cta-home',
          type: 'cta_band',
          settings: {
            heading: 'New to church?',
            body: 'See what to expect and let us help you feel at home from day one.',
            ctaLabel: 'Start Here',
            ctaHref: '/new-here',
          },
        },
        {
          id: 'footer-home',
          type: 'footer',
          settings: {
            title: 'Noxera Church',
            body: 'Building faith, family, and mission in every generation.',
            links: [
              { label: 'About', href: '/about' },
              { label: 'Service Times', href: '/service-times' },
              { label: 'Contact', href: '/contact' },
              { label: 'Give', href: '/give' },
            ],
          },
        },
      ],
    }),
  },
  {
    key: 'mission-grid',
    name: 'Mission Grid',
    family: 'Corporate Ministry',
    description: 'Mission-forward template with modern card-heavy storytelling.',
    previewImageUrl: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1400&q=80',
    status: 'published',
    themeConfig: {
      siteName: 'Mission Grid Church',
      logoUrl: '/brand-logo.svg',
      contactLine: 'Join us every Sunday. New visitors always welcome.',
      navCtaLabel: 'Give Now',
      navCtaHref: '/give',
      templateStyle: 'midnight-modern',
      layoutMode: 'custom',
      customContentWidth: 1680,
      primaryColor: '#1d4ed8',
      accentColor: '#22c55e',
      font: 'manrope',
      radiusScale: 'md',
      elevationScale: 'strong',
      spacingScale: 'spacious',
    },
    pages: withPageKit({
      slug: 'home',
      title: 'Home',
      blocks: [
        {
          id: 'hero-home',
          type: 'hero',
          settings: {
            eyebrow: 'Community + Mission',
            title: 'A modern church for your whole family.',
            subtitle: 'Gather, grow, and serve with clear pathways from first visit to active discipleship.',
            primaryCtaLabel: 'Join This Sunday',
            primaryCtaHref: '/service-times',
            secondaryCtaLabel: 'Our Mission',
            secondaryCtaHref: '/about',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1516264663583-6f97a12b1b2e?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'features-home',
          type: 'feature_grid',
          settings: {
            heading: 'Next steps made simple',
            items: [
              { title: 'Visit', description: 'Plan your first Sunday with confidence.' },
              { title: 'Connect', description: 'Join a group and find real relationships.', imageUrl: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80' },
              { title: 'Serve', description: 'Use your gifts to impact lives.', imageUrl: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1200&q=80' },
            ],
          },
        },
        {
          id: 'stats-home',
          type: 'stats',
          settings: {
            heading: 'Mission outcomes',
            items: [
              { label: 'Active Volunteers', value: '280' },
              { label: 'Community Projects', value: '36' },
              { label: 'Families Reached', value: '1,900+' },
            ],
          },
        },
        {
          id: 'sermons-home',
          type: 'dynamic_list',
          settings: {
            source: 'sermons',
            heading: 'Latest sermons',
            count: 4,
            fallback: {
              heading: 'Latest sermons',
              body: 'Published sermon recordings will appear here.',
            },
          },
        },
        {
          id: 'cta-home',
          type: 'cta_band',
          settings: {
            heading: 'Ready to get connected?',
            body: 'Take your next step through groups, teams, and practical discipleship tracks.',
            ctaLabel: 'Explore Ministries',
            ctaHref: '/ministries',
          },
        },
      ],
    }),
  },
  {
    key: 'neighborhood-connect',
    name: 'Neighborhood Connect',
    family: 'Community Growth',
    description: 'Friendly community style focused on belonging and local outreach.',
    previewImageUrl: 'https://images.unsplash.com/photo-1445445290350-18a3b86e0b5d?auto=format&fit=crop&w=1400&q=80',
    status: 'published',
    themeConfig: {
      siteName: 'Neighborhood Connect Church',
      logoUrl: '/brand-logo.svg',
      contactLine: 'Community first church operations with warm welcome teams.',
      navCtaLabel: 'Plan Visit',
      navCtaHref: '/new-here',
      templateStyle: 'community-warm',
      layoutMode: 'boxed',
      customContentWidth: 1320,
      primaryColor: '#0f766e',
      accentColor: '#f59e0b',
      font: 'nunito-sans',
      radiusScale: 'lg',
      elevationScale: 'soft',
      spacingScale: 'spacious',
    },
    pages: withPageKit({
      slug: 'home',
      title: 'Home',
      blocks: [
        {
          id: 'hero-home',
          type: 'hero',
          settings: {
            eyebrow: 'Welcome Home',
            title: 'A place to belong, believe, and become.',
            subtitle: 'We are a local church helping people find hope and purpose.',
            primaryCtaLabel: 'Plan Your Visit',
            primaryCtaHref: '/new-here',
            secondaryCtaLabel: 'Find A Group',
            secondaryCtaHref: '/ministries',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'testimonials-home',
          type: 'testimonials',
          settings: {
            heading: 'Stories from our church family',
            items: [
              { quote: 'This church gave us community from day one.', author: 'Family Member' },
              { quote: 'I found purpose through serving on a team.', author: 'Volunteer' },
            ],
          },
        },
        {
          id: 'services-home',
          type: 'service_times',
          settings: {
            heading: 'Weekend rhythm',
            items: DEFAULT_SERVICE_TIMES,
          },
        },
        {
          id: 'neighborhood-gallery',
          type: 'gallery',
          settings: {
            heading: 'Life in our neighborhood',
            items: [
              { imageUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1200&q=80', title: 'Sunday Worship' },
              { imageUrl: 'https://images.unsplash.com/photo-1529078155058-5d716f45d604?auto=format&fit=crop&w=1200&q=80', title: 'Prayer Nights' },
              { imageUrl: 'https://images.unsplash.com/photo-1445445290350-18a3b86e0b5d?auto=format&fit=crop&w=1200&q=80', title: 'Community Outreach' },
            ],
          },
        },
        {
          id: 'cta-home',
          type: 'cta_band',
          settings: {
            heading: 'You belong here.',
            body: 'Bring your family this Sunday and meet a welcoming church community.',
            ctaLabel: 'Plan Your Visit',
            ctaHref: '/new-here',
          },
        },
      ],
    }),
  },
  {
    key: 'hope-path',
    name: 'Hope Path',
    family: 'Community Growth',
    description: 'Growth-focused template with gentle gradients and conversion sections.',
    previewImageUrl: 'https://images.unsplash.com/photo-1529078155058-5d716f45d604?auto=format&fit=crop&w=1400&q=80',
    status: 'published',
    themeConfig: {
      siteName: 'Hope Path Church',
      logoUrl: '/brand-logo.svg',
      contactLine: 'Pathways for discipleship, care, and church growth.',
      navCtaLabel: 'Start Here',
      navCtaHref: '/new-here',
      templateStyle: 'growth-gradient',
      layoutMode: 'custom',
      customContentWidth: 1540,
      primaryColor: '#7c3aed',
      accentColor: '#06b6d4',
      font: 'source-sans-3',
      radiusScale: 'lg',
      elevationScale: 'soft',
      spacingScale: 'balanced',
    },
    pages: withPageKit({
      slug: 'home',
      title: 'Home',
      blocks: [
        {
          id: 'hero-home',
          type: 'hero',
          settings: {
            eyebrow: 'Pathway to Growth',
            title: 'Take your next faith step with us.',
            subtitle: 'From first visit to leadership development, we walk with you.',
            primaryCtaLabel: 'Start Here',
            primaryCtaHref: '/new-here',
            secondaryCtaLabel: 'Weekly Rhythm',
            secondaryCtaHref: '/service-times',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1544427920-c49ccfb85579?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'faq-home',
          type: 'faq',
          settings: {
            heading: 'Frequently asked questions',
            items: [
              { question: 'What should I wear?', answer: 'Come as you are.' },
              { question: 'Do you have kids programs?', answer: 'Yes, every weekend service.' },
            ],
          },
        },
        {
          id: 'dynamic-home',
          type: 'dynamic_list',
          settings: {
            source: 'events',
            heading: 'Upcoming gatherings',
            count: 4,
            fallback: {
              heading: 'Upcoming gatherings',
              body: 'Our next events will appear here.',
            },
          },
        },
        {
          id: 'growth-stats',
          type: 'stats',
          settings: {
            heading: 'Healthy growth indicators',
            items: [
              { label: 'New Families', value: '120' },
              { label: 'Groups Active', value: '28' },
              { label: 'Baptisms', value: '43' },
              { label: 'Volunteer Teams', value: '19' },
            ],
          },
        },
        {
          id: 'cta-home',
          type: 'cta_band',
          settings: {
            heading: 'Take your first step today.',
            body: 'Connect with our team and we will guide your next step.',
            ctaLabel: 'Connect',
            ctaHref: '/contact',
          },
        },
      ],
    }),
  },
  {
    key: 'cathedral-modern',
    name: 'Cathedral Modern',
    family: 'Classic Church Modern',
    description: 'Classic editorial rhythm blended with contemporary CTA sections.',
    previewImageUrl: 'https://images.unsplash.com/photo-1466442929976-97f336a657be?auto=format&fit=crop&w=1400&q=80',
    status: 'published',
    themeConfig: {
      siteName: 'Cathedral Modern Church',
      logoUrl: '/brand-logo.svg',
      contactLine: 'Historic roots, modern ministry rhythm.',
      navCtaLabel: 'Donate Online',
      navCtaHref: '/give',
      templateStyle: 'classic-red',
      layoutMode: 'boxed',
      customContentWidth: 1280,
      primaryColor: '#111827',
      accentColor: '#d97706',
      font: 'inter',
      radiusScale: 'md',
      elevationScale: 'soft',
      spacingScale: 'spacious',
    },
    pages: withPageKit({
      slug: 'home',
      title: 'Home',
      blocks: [
        {
          id: 'hero-home',
          type: 'hero',
          settings: {
            eyebrow: 'Historic Faith. Modern Hope.',
            title: 'Worship deeply. Serve boldly. Love widely.',
            subtitle: 'A church rooted in scripture and committed to our city.',
            primaryCtaLabel: 'Worship With Us',
            primaryCtaHref: '/service-times',
            secondaryCtaLabel: 'Meet Our Team',
            secondaryCtaHref: '/about',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1519491050282-cf00c82424b4?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'service-home',
          type: 'service_times',
          settings: {
            heading: 'Service Times',
            items: [
              { label: 'Sunday Worship', value: '8:00 AM, 10:00 AM' },
              { label: 'Midweek Gathering', value: 'Wednesday 6:30 PM' },
            ],
          },
        },
        {
          id: 'staff-home',
          type: 'staff_cards',
          settings: {
            heading: 'Pastoral team',
            items: [
              { name: 'Lead Pastor', role: 'Senior Pastor' },
              { name: 'Care Pastor', role: 'Pastoral Care' },
              { name: 'Worship Pastor', role: 'Creative Arts' },
            ],
          },
        },
        {
          id: 'classic-events',
          type: 'dynamic_list',
          settings: {
            source: 'events',
            heading: 'Upcoming events',
            count: 3,
            fallback: {
              heading: 'Upcoming events',
              body: 'Event publishing is in progress.',
            },
          },
        },
        {
          id: 'footer-home',
          type: 'footer',
          settings: {
            title: 'Cathedral Modern Church',
            body: 'Historic faith and modern mission for everyday life.',
            links: [
              { label: 'About', href: '/about' },
              { label: 'Sermons', href: '/sermons' },
              { label: 'Events', href: '/events' },
            ],
          },
        },
      ],
    }),
  },
  {
    key: 'heritage-contemporary',
    name: 'Heritage Contemporary',
    family: 'Classic Church Modern',
    description: 'Balanced church template combining legacy trust and modern engagement.',
    previewImageUrl: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1400&q=80',
    status: 'published',
    themeConfig: {
      siteName: 'Heritage Contemporary Church',
      logoUrl: '/brand-logo.svg',
      contactLine: 'A modern church platform for every generation.',
      navCtaLabel: 'Donate',
      navCtaHref: '/give',
      templateStyle: 'classic-contemporary',
      layoutMode: 'full',
      customContentWidth: 1700,
      primaryColor: '#0f172a',
      accentColor: '#ec4899',
      font: 'poppins',
      radiusScale: 'lg',
      elevationScale: 'soft',
      spacingScale: 'balanced',
    },
    pages: withPageKit({
      slug: 'home',
      title: 'Home',
      blocks: [
        {
          id: 'hero-home',
          type: 'hero',
          settings: {
            eyebrow: 'Faith + Community',
            title: 'Where generations worship together.',
            subtitle: 'Experience authentic worship, biblical teaching, and practical community.',
            primaryCtaLabel: 'Visit This Week',
            primaryCtaHref: '/new-here',
            secondaryCtaLabel: 'Watch Messages',
            secondaryCtaHref: '/sermons',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=1800&q=80',
          },
        },
        {
          id: 'staff-home',
          type: 'staff_cards',
          settings: {
            heading: 'Meet our pastors',
            items: [
              { name: 'Lead Pastor', role: 'Senior Pastor' },
              { name: 'Care Pastor', role: 'Pastoral Care' },
            ],
          },
        },
        {
          id: 'gallery-home',
          type: 'gallery',
          settings: {
            heading: 'Church life moments',
            items: [
              { imageUrl: 'https://images.unsplash.com/photo-1548625361-58a9b86aa83b?auto=format&fit=crop&w=1200&q=80', title: 'Sunday Worship' },
              { imageUrl: 'https://images.unsplash.com/photo-1515165562835-c4c9a7d0b9e0?auto=format&fit=crop&w=1200&q=80', title: 'Community Groups' },
              { imageUrl: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80', title: 'Serve Day' },
            ],
          },
        },
        {
          id: 'heritage-testimonials',
          type: 'testimonials',
          settings: {
            heading: 'What people are saying',
            items: [
              { quote: 'The teaching is biblical and practical for every week.', author: 'Church Member' },
              { quote: 'Our children feel known and loved every Sunday.', author: 'Parent' },
            ],
          },
        },
        {
          id: 'cta-home',
          type: 'cta_band',
          settings: {
            heading: 'Join us this week',
            body: 'Experience a welcoming community and practical biblical teaching.',
            ctaLabel: 'Get Directions',
            ctaHref: '/contact',
          },
        },
      ],
    }),
  },
];
