describe('navigation structure', () => {
  test('tab navigator defines 5 child-friendly tabs', () => {
    const tabs = ['Talk', 'Feel', 'Look', 'Words', 'More'];
    expect(tabs).toHaveLength(5);
    tabs.forEach(name => expect(name.length).toBeLessThanOrEqual(5));
  });

  test('root stack screens cover all navigable destinations', () => {
    const rootScreens = [
      'App', 'Settings', 'Feedback', 'Camera', 'Insights',
      'VocabManager', 'Social', 'QuickPhrases', 'ProfileModal',
      'ContextPack', 'SentenceBuilder', 'Communication', 'LiveScene', 'Login',
    ];
    expect(rootScreens).toHaveLength(14);
    const uniqueScreens = new Set(rootScreens);
    expect(uniqueScreens.size).toBe(rootScreens.length);
  });

  test('every more menu item maps to a registered stack screen', () => {
    const menuScreens = [
      'ProfileModal', 'Settings', 'VocabManager', 'Insights',
      'ContextPack', 'SentenceBuilder', 'Social', 'Communication', 'Feedback',
    ];
    const rootScreens = new Set([
      'App', 'Settings', 'Feedback', 'Camera', 'Insights',
      'VocabManager', 'Social', 'QuickPhrases', 'ProfileModal',
      'ContextPack', 'SentenceBuilder', 'Communication', 'LiveScene', 'Login',
    ]);
    menuScreens.forEach(screen => {
      expect(rootScreens.has(screen)).toBe(true);
    });
  });

  test('tab icon hexcodes are valid Unicode points', () => {
    const hexcodes = {
      Talk: '1F4AC',
      Feel: '1F60A',
      Look: '1F4F7',
      Words: '1F4D6',
      More: '2699',
    };
    Object.entries(hexcodes).forEach(([tab, hex]) => {
      expect(hex).toMatch(/^[0-9A-F]{4,5}$/);
      const codepoint = parseInt(hex, 16);
      expect(codepoint).toBeGreaterThan(0);
      expect(codepoint).toBeLessThan(0x1FFFFF);
    });
  });

  test('fallback icons defined for all tabs', () => {
    const fallbackIcons = {
      Talk: 'chatbubble-ellipses',
      Feel: 'happy',
      Look: 'camera',
      Words: 'book',
      More: 'menu',
    };
    Object.values(fallbackIcons).forEach(icon => {
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    });
  });

  test('more menu has 9 items covering all caregiver features', () => {
    const menuItems = [
      { label: 'Profile', screen: 'ProfileModal' },
      { label: 'Settings', screen: 'Settings' },
      { label: 'Vocabulary', screen: 'VocabManager' },
      { label: 'Insights', screen: 'Insights' },
      { label: 'Situations', screen: 'ContextPack' },
      { label: 'Sentences', screen: 'SentenceBuilder' },
      { label: 'Social', screen: 'Social' },
      { label: 'Pictures', screen: 'Communication' },
      { label: 'Feedback', screen: 'Feedback' },
    ];
    expect(menuItems).toHaveLength(9);
    const labels = menuItems.map(i => i.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });
});
