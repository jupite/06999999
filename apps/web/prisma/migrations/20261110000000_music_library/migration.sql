CREATE TABLE "MusicLibraryTrack" (
    "position" SERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "coverUrl" TEXT,

    CONSTRAINT "MusicLibraryTrack_pkey" PRIMARY KEY ("position")
);

CREATE UNIQUE INDEX "MusicLibraryTrack_id_key" ON "MusicLibraryTrack"("id");
