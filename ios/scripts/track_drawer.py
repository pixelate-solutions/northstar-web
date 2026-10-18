# Prints the drawer grabber position (y, in a 240px-wide frame) whenever it changes. Used by check-drawer-motion.sh.
import glob, sys, subprocess, os, shutil
from PIL import Image
video = sys.argv[1]
d = '/tmp/ns-track-frames'
shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
subprocess.run(['ffmpeg','-loglevel','fatal','-i',video,'-vsync','0','-vf','scale=240:-1',f'{d}/f%05d.png'],check=True)
# frame timestamps
ts = subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','frame=pts_time','-of','csv=p=0',video],capture_output=True,text=True).stdout.split()
res=[]
for f in sorted(glob.glob(f'{d}/*.png')):
    im=Image.open(f).convert('RGB'); w,h=im.size; px=im.load(); g=None
    for y in range(int(h*0.03),int(h*0.97)):
        cnt=sum(1 for x in range(int(w*0.45),int(w*0.55)) if 195<=px[x,y][0]<=222 and abs(px[x,y][0]-px[x,y][1])<6 and abs(px[x,y][0]-px[x,y][2])<6)
        if cnt>=int(w*0.06) and min(px[w//2,max(0,y-3)])>235: g=y;break
    res.append(g)
pts=[(float(ts[i].strip(',')) if i<len(ts) else i/60, y) for i,y in enumerate(res)]
seq=[];last=object()
for t,y in pts:
    if y!=last: seq.append(f"{t:.2f}s:{y}"); last=y
print(" ".join(seq))
