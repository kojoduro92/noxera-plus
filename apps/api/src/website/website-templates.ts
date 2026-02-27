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

function pageKitBlocks(pageSlug: string): WebsiteBlock[] {
  if (pageSlug === 'events') {
    return [
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
  }

  if (pageSlug === 'sermons') {
    return [
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
    ];
  }

  if (pageSlug === 'new-here') {
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
  }

  if (pageSlug === 'give') {
    return [
      {
        id: 'give-cta',
        type: 'dynamic_list',
        settings: {
          source: 'giving',
          heading: 'Ways to Give',
          count: 5,
          fallback: {
            heading: 'Ways to Give',
            body: 'Online giving setup is in progress. Contact the church office for giving options.',
          },
        },
      },
    ];
  }

  if (pageSlug === 'contact') {
    return [
      {
        id: 'contact-map',
        type: 'map_contact',
        settings: {
          heading: 'Find and Contact Us',
          address: '123 Community Road',
          email: 'hello@church.org',
          phone: '+1 (000) 000-0000',
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
    ];
  }

  return [
    {
      id: `${pageSlug}-hero`,
      type: 'hero',
      settings: {
        eyebrow: pageSlug.replace(/-/g, ' ').toUpperCase(),
        title: pageSlug
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        subtitle: 'Edit this section with your own story and ministry details.',
        primaryCtaLabel: 'Learn More',
        primaryCtaHref: '/contact',
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
    previewImageUrl: '/templates/civic-light.png',
    status: 'published',
    themeConfig: {
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
          id: 'cta-home',
          type: 'cta_band',
          settings: {
            heading: 'New to church?',
            body: 'See what to expect and let us help you feel at home from day one.',
            ctaLabel: 'Start Here',
            ctaHref: '/new-here',
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
    previewImageUrl: '/templates/mission-grid.png',
    status: 'published',
    themeConfig: {
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
          },
        },
        {
          id: 'features-home',
          type: 'feature_grid',
          settings: {
            heading: 'Next steps made simple',
            items: [
              { title: 'Visit', description: 'Plan your first Sunday with confidence.' },
              { title: 'Connect', description: 'Join a group and find real relationships.' },
              { title: 'Serve', description: 'Use your gifts to impact lives.' },
            ],
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
    previewImageUrl: '/templates/neighborhood-connect.png',
    status: 'published',
    themeConfig: {
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
      ],
    }),
  },
  {
    key: 'hope-path',
    name: 'Hope Path',
    family: 'Community Growth',
    description: 'Growth-focused template with gentle gradients and conversion sections.',
    previewImageUrl: '/templates/hope-path.png',
    status: 'published',
    themeConfig: {
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
      ],
    }),
  },
  {
    key: 'cathedral-modern',
    name: 'Cathedral Modern',
    family: 'Classic Church Modern',
    description: 'Classic editorial rhythm blended with contemporary CTA sections.',
    previewImageUrl: '/templates/cathedral-modern.png',
    status: 'published',
    themeConfig: {
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
      ],
    }),
  },
  {
    key: 'heritage-contemporary',
    name: 'Heritage Contemporary',
    family: 'Classic Church Modern',
    description: 'Balanced church template combining legacy trust and modern engagement.',
    previewImageUrl: '/templates/heritage-contemporary.png',
    status: 'published',
    themeConfig: {
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
      ],
    }),
  },
];
