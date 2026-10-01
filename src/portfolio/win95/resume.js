// Julian's CV as a document, built from the same data as the rest of the desktop: profile.json
// (about, skills, projects, contact) and departments.json (the training departments, newest first).
// WordPad shows and prints the blocks; Find searches the plain text.
//
// Blocks: { type: 'title' | 'subtitle' | 'heading' | 'paragraph', text }
//         { type: 'list', items: [text] }
//         { type: 'entry', title, meta, detail, items: [text] }

export function buildResume(profile, departments) {
  const contact = [profile.email, profile.contact].filter(Boolean).join(' · ')
  const experience = departments
    .filter((d) => d.period)
    .reverse()
    .map((d) => ({
      type: 'entry',
      title: d.name,
      meta: d.period,
      detail: [d.year, d.rating && `Trainer's grade: ${d.rating}`].filter(Boolean).join(' · '),
      items: d.tasks ?? [],
    }))
  const next = departments.filter((d) => !d.period).map((d) => d.name)

  return [
    { type: 'title', text: profile.name },
    contact && { type: 'subtitle', text: contact },
    profile.about && { type: 'paragraph', text: profile.about },
    profile.skills?.length && { type: 'heading', text: 'Skills' },
    profile.skills?.length && { type: 'list', items: profile.skills },
    experience.length && { type: 'heading', text: 'Training departments' },
    ...experience,
    next.length && { type: 'paragraph', text: `Next: ${next.join(', ')}.` },
    profile.projects?.length && { type: 'heading', text: 'Projects' },
    profile.projects?.length && { type: 'list', items: profile.projects },
  ].filter(Boolean)
}

export function resumeText(blocks) {
  return blocks
    .flatMap((block) => {
      if (block.type === 'list') return block.items.map((item) => `- ${item}`)
      if (block.type === 'entry') return [`${block.title} (${block.meta})`, block.detail, ...block.items.map((item) => `- ${item}`)]
      return [block.text]
    })
    .filter(Boolean)
    .join('\n')
}
