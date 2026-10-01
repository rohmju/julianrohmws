import nope from './nope.gif'

// What the desktop opens instead of deleting anything.
export default function Nope() {
  return (
    <div className="w95-app w95-nope">
      <img src={nope} alt="An angry smiley wagging its finger: no." draggable={false} />
    </div>
  )
}
