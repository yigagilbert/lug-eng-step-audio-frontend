"use client";

type AvatarSpeakerProps = {
  speaking: boolean;
};

export function AvatarSpeaker({ speaking }: AvatarSpeakerProps) {
  return (
    <div
      className={speaking ? "avatar avatarSpeaking" : "avatar"}
      aria-label={speaking ? "English speech is playing" : "Avatar waiting"}
      role="img"
    >
      <div className="avatarFace">
        <span className="avatarEye avatarEyeLeft" />
        <span className="avatarEye avatarEyeRight" />
        <span className="avatarCheek avatarCheekLeft" />
        <span className="avatarCheek avatarCheekRight" />
        <span className="avatarMouth" />
      </div>
    </div>
  );
}
