import { useEffect, useRef, useState } from "react";
import invitations from "./data/invitations.json";

type Invitation = (typeof invitations)[number];
type Attendance = "yes" | "no";
type MusicStatus = "loading" | "playing" | "paused" | "blocked" | "error";
type SyncStatus = "idle" | "saving" | "saved" | "error";

const storageKey = (id: string) => `graduation-invitation:${id}`;
const musicSource = encodeURI(
  "/A Little Dream Of Me - Lyrics Video - Cảm Ơn Người Đã Thức Cùng Tôi OST.mp3",
);

function getInvitation(): Invitation | undefined {
  const id = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).at(-1) ?? "");
  return id ? invitations.find((item) => item.id === id) : invitations[0];
}

function App() {
  const invitation = getInvitation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [note, setNote] = useState("");
  const [storageError, setStorageError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [responseChanged, setResponseChanged] = useState(false);
  const [responseRevision, setResponseRevision] = useState(0);
  const [musicStatus, setMusicStatus] = useState<MusicStatus>("loading");
  const audioRef = useRef<HTMLAudioElement>(null);
  const guestFirstName = invitation?.guestName.split(" ").at(-1) ?? "";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setMusicStatus("blocked");
        return;
      }

      console.error("Không thể tự phát nhạc thư mời.", error);
      setMusicStatus("error");
    });
  }, []);

  useEffect(() => {
    if (!invitation) return;
    try {
      const saved = window.localStorage.getItem(storageKey(invitation.id));
      if (!saved) return;
      const response = JSON.parse(saved) as { attendance?: Attendance; note?: string };
      setAttendance(response.attendance ?? null);
      setNote(response.note ?? "");
    } catch (error) {
      console.error("Không thể đọc lời xác nhận đã lưu.", error);
      setStorageError("Không thể đọc phản hồi đã lưu trên thiết bị này.");
    }
  }, [invitation]);

  useEffect(() => {
    if (!detailsOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [detailsOpen]);

  useEffect(() => {
    if (!invitation || !responseChanged || attendance === null) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSyncStatus("saving");
      try {
        const response = await fetch("/api/rsvp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: invitation.id,
            data: {
              attending: attendance === "yes",
              message: note,
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const result = await response.json() as { error?: string };
          throw new Error(result.error || `Máy chủ trả về ${response.status}.`);
        }
        setSyncError("");
        setSyncStatus("saved");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Không thể đồng bộ phản hồi lên Supabase.", error);
        setSyncError(error instanceof Error ? error.message : "Không thể lưu phản hồi.");
        setSyncStatus("error");
      }
    }, 500);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attendance, invitation, note, responseChanged, responseRevision]);

  if (!invitation) {
    return (
      <main className="not-found">
        <p className="eyebrow">THƯ MỜI TỐT NGHIỆP</p>
        <h1>Chưa tìm thấy thiệp mời này</h1>
        <p>Vui lòng kiểm tra lại đường dẫn được gửi cho bạn.</p>
      </main>
    );
  }

  const saveResponse = (nextAttendance: Attendance | null, nextNote: string) => {
    setAttendance(nextAttendance);
    setResponseChanged(true);
    setResponseRevision((revision) => revision + 1);
    setSyncError("");
    try {
      window.localStorage.setItem(
        storageKey(invitation.id),
        JSON.stringify({ attendance: nextAttendance, note: nextNote }),
      );
      setStorageError("");
    } catch (error) {
      console.error("Không thể lưu lời xác nhận trên thiết bị này.", error);
      setStorageError("Không thể lưu phản hồi trên thiết bị này.");
    }
  };

  const handleAttendance = (value: Attendance) => saveResponse(value, note);
  const handleNoteChange = (value: string) => {
    setNote(value);
    saveResponse(attendance, value);
  };

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    audio.play().catch((error: unknown) => {
      console.error("Không thể phát nhạc thư mời.", error);
      setMusicStatus("error");
    });
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Thư mời tốt nghiệp">
          <span className="wordmark-mark">T</span>
          <span>THƯ MỜI TỐT NGHIỆP</span>
        </a>
        <button
          className="music-toggle"
          type="button"
          onClick={toggleMusic}
          aria-label={musicStatus === "playing" ? "Tắt nhạc" : "Bật nhạc"}
          title={musicStatus === "error" ? "Không thể tải nhạc" : undefined}
        >
          <span aria-hidden="true">{musicStatus === "playing" ? "♫" : "♪"}</span>
          {musicStatus === "playing" ? "ĐANG PHÁT" : musicStatus === "error" ? "NHẠC LỖI" : "BẬT NHẠC"}
        </button>
        <span className="edition">07 · 11 · 2026</span>
      </header>

      <audio
        ref={audioRef}
        src={musicSource}
        loop
        preload="auto"
        onPlay={() => setMusicStatus("playing")}
        onPause={() => setMusicStatus("paused")}
        onError={() => {
          console.error("Không tải được tệp nhạc thư mời.");
          setMusicStatus("error");
        }}
      />

      <section className="invitation-layout" aria-label="Thiệp mời tốt nghiệp">
        <div className="intro">
          <p className="eyebrow"><span className="eyebrow-line" /> MỘT NGÀY ĐẶC BIỆT</p>
          <h1>Một cột mốc,<br /><em>muốn có bạn.</em></h1>
          <p className="intro-copy">
            Có những khoảnh khắc sẽ trọn vẹn hơn khi được sẻ chia. Trọng thân mời bạn cùng
            đến chung vui trong ngày tốt nghiệp.
          </p>
          <button className="primary-button" onClick={() => setDetailsOpen(true)}>
            Xem chi tiết <span aria-hidden="true">↗</span>
          </button>
          <div className="scroll-hint"><span /> CUỘN ĐỂ KHÁM PHÁ</div>
        </div>

        <div className="invite-art">
          <div className="art-glow" aria-hidden="true" />
          <div className="invite-frame">
            <img src={invitation.svg} alt={`Thiệp mời tốt nghiệp gửi đến ${invitation.guestName}`} />
          </div>
          <span className="art-index">01 <i /> 01</span>
        </div>
      </section>

      <footer className="page-footer">
        <span>MỘT LỜI MỜI NHỎ, MỘT NIỀM VUI LỚN</span>
        <span>THÂN MẾN, TRỌNG <b>♥</b></span>
      </footer>

      {detailsOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDetailsOpen(false);
        }}>
          <section className="details-panel" role="dialog" aria-modal="true" aria-labelledby="details-title">
            <button className="close-button" onClick={() => setDetailsOpen(false)} aria-label="Đóng">
              ×
            </button>
            <p className="eyebrow"><span className="eyebrow-line" /> LỜI NHẮN TỪ TRỌNG</p>
            <h2 id="details-title">Gửi {invitation.guestName},</h2>
            <p className="personal-message">{invitation.message}</p>

            <div className="event-card">
              <span className="event-date">07<br /><small>THÁNG 11</small></span>
              <div>
                <strong>Lễ tốt nghiệp</strong>
                <p>12:30 – 14:00 · Thứ Bảy, 07.11.2026</p>
                <p>Trường Đại học FPT</p>
              </div>
            </div>

            <div className="response-section">
              <h3>{guestFirstName} sẽ đến chứ?</h3>
              <p>Trọng rất mong nhận được hồi âm của bạn.</p>
              <div className="attendance-options">
                <button
                  className={attendance === "yes" ? "choice-button selected" : "choice-button"}
                  onClick={() => handleAttendance("yes")}
                >
                  <AttendanceIcon attending /> Mình sẽ đến
                </button>
                <button
                  className={attendance === "no" ? "choice-button selected" : "choice-button"}
                  onClick={() => handleAttendance("no")}
                >
                  <AttendanceIcon /> Rất tiếc, mình bận
                </button>
              </div>
              <label className="note-label" htmlFor="guest-note">ĐỂ LẠI ĐÔI DÒNG CHO TRỌNG</label>
              <textarea
                id="guest-note"
                placeholder="Viết lời chúc hoặc nhắn nhủ của bạn..."
                value={note}
                maxLength={500}
                onChange={(event) => handleNoteChange(event.target.value)}
                rows={3}
              />
              <p className={storageError || syncStatus === "error" ? "save-notice error" : "save-notice"}>
                {storageError || syncError || (
                  syncStatus === "saving" ? "Đang đồng bộ phản hồi..." :
                  syncStatus === "saved" ? "Đã lưu phản hồi." :
                  syncStatus === "error" ? "Không thể lưu phản hồi. Vui lòng thử lại." :
                  attendance === null
                    ? "Vui lòng chọn xác nhận tham dự để lưu phản hồi."
                    : "Phản hồi sẽ được lưu khi bạn chọn hoặc nhập nội dung."
                )}
              </p>
            </div>
            <section className="details-location" aria-labelledby="location-title">
              <p className="eyebrow"><span className="eyebrow-line" /> HẸN GẶP BẠN Ở ĐÓ</p>
              <h3 id="location-title">Bản đồ địa điểm</h3>
              <p className="details-location-address">Trường Đại học FPT · TP. Hồ Chí Minh</p>
              <div className="map-frame">
                <iframe
                  title="Bản đồ Trường Đại học FPT Thành phố Hồ Chí Minh"
                  src="https://maps.google.com/maps?q=Tr%C6%B0%E1%BB%9Dng%20%C4%90%E1%BA%A1i%20h%E1%BB%8Dc%20FPT%2C%20Th%C3%A0nh%20ph%E1%BB%91%20H%E1%BB%93%20Ch%C3%AD%20Minh&t=&z=14&ie=UTF8&iwloc=&output=embed"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              <a
                className="directions-link location-directions"
                href="https://www.google.com/maps/dir/?api=1&destination=Tr%C6%B0%E1%BB%9Dng%20%C4%90%E1%BA%A1i%20h%E1%BB%8Dc%20FPT%2C%20Th%C3%A0nh%20ph%E1%BB%91%20H%E1%BB%93%20Ch%C3%AD%20Minh"
                target="_blank"
                rel="noreferrer"
              >
                <MapIcon /> Chỉ đường với Google Maps <span aria-hidden="true">↗</span>
              </a>
            </section>
          </section>
        </div>
      )}
    </main>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.3" />
    </svg>
  );
}

function AttendanceIcon({ attending = false }: { attending?: boolean }) {
  return (
    <svg className="choice-button-icon" viewBox="0 0 20 20" aria-hidden="true">
      {attending ? (
        <>
          <circle cx="10" cy="10" r="7.25" />
          <path d="m6.8 10.1 2.1 2.1 4.4-4.5" />
        </>
      ) : (
        <>
          <circle cx="10" cy="10" r="7.25" />
          <path d="m7.5 7.5 5 5m0-5-5 5" />
        </>
      )}
    </svg>
  );
}

export default App;
