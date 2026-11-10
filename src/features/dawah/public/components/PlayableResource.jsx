import { isPlayableAudio, isPlayableVideo } from '../api/dawahPublicService.js'
import AudioPlayer from './AudioPlayer.jsx'
import VideoEmbed from './VideoEmbed.jsx'

/** Player for ready published audio or an existing YouTube video; anything else is explicitly unavailable. */
export default function PlayableResource({ resource }) {
  if (resource.type === 'vid') {
    if (!isPlayableVideo(resource)) {
      return (
        <p role="status" className="text-sm text-[#6B7280] dark:text-gray-300">
          This video is not available right now.
        </p>
      )
    }
    return <VideoEmbed playback={resource.playback} title={resource.title} />
  }
  if (resource.type !== 'aud') {
    return <p className="text-sm text-[#6B7280] dark:text-gray-300">This type of content is not available to play here yet.</p>
  }
  if (!isPlayableAudio(resource)) {
    return (
      <p role="status" className="text-sm text-[#6B7280] dark:text-gray-300">
        This audio is not available right now.
      </p>
    )
  }
  return <AudioPlayer key={resource.mediaUrl} src={resource.mediaUrl} title={resource.title} durationHint={resource.duration} />
}
