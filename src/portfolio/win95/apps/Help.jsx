import { useWin95 } from '../context.js'

// Windows Help, rewritten as a guide to this desktop for visitors who never used Windows 95.
export default function Help() {
  const { coarsePointer } = useWin95()
  const open = coarsePointer ? 'Tap' : 'Double-click'

  return (
    <div className="w95-app w95-help">
      <div className="w95-well">
        <article className="w95-help__page">
          <h2>Welcome to Julian&rsquo;s departments</h2>
          <p>This computer holds the departments Julian Rohm has worked in, one folder each.</p>

          <h3>To read or download Julian&rsquo;s CV</h3>
          <ul>
            <li>{open} Resume.doc on the desktop.</li>
            <li>In WordPad, click Print, and choose &ldquo;Save as PDF&rdquo; to keep a copy.</li>
          </ul>

          <h3>To get in touch</h3>
          <p>{open} Contact Julian on the desktop, type your message, and click Connect.</p>

          <h3>To find something</h3>
          <p>Click Start, point to Find, and click Files or Folders. Type a skill or a department, such as Terraform.</p>

          <h3>To open a department</h3>
          <ul>
            <li>{open} its folder on the desktop.</li>
            <li>{open} a text file to read it in Notepad.</li>
          </ul>

          <h3>To work with windows</h3>
          <ul>
            <li>Drag a window by its title bar to move it, or by its lower-right corner to resize it.</li>
            <li>Use the buttons in its upper-right corner to minimize, maximize or close it.</li>
            <li>Every open window has a button on the taskbar. Click it to switch to that window.</li>
          </ul>

          <h3>To play Minesweeper</h3>
          <p>
            {open} Minesweeper on the desktop, or click Start, point to Programs, Accessories and Games, and click
            Minesweeper.
            {coarsePointer
              ? ' Tap a square to uncover it; touch and hold to plant a flag.'
              : ' Click a square to uncover it; right-click to plant a flag.'}
          </p>

          <h3>To ask questions</h3>
          <p>
            {open} Ask Julian on the desktop and type a question about Julian, or about anything else. With Minesweeper
            open, ask it for a hint.
          </p>

          <h3>To leave</h3>
          <p>Click Start, click Shut Down, and then click Yes.</p>
        </article>
      </div>
    </div>
  )
}
