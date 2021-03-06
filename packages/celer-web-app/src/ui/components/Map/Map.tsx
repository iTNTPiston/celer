import { Overlay, MapProps as PigeonMapProps } from "pigeon-maps";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { 
	DynamicCanvasSizeX, 
	DynamicCanvasSizeZ, 
	geoCoord, 
	GeoCoordinates, 
	geoToInGameCoord, 
	inGameCoord, 
	InGameCoordinates, 
	inGameToGeoCoord, 
	internalTileUrl, 
	MapCanvas, 
	NewMapIcon, 
	NewMapLine, 
	SvgSizeX, 
	SvgSizeZ, 
	zoomToSvgScale 
} from "core/map";
import Icons from "data/image";
import { MapOverride } from "./MapOverride";
import { MapSvg } from "./MapSvg";
import { MapTile } from "./MapTile";

export interface MapProps {
    icons: NewMapIcon[];
    lines: NewMapLine[];
    setSetCenterListener: (listener: (center: InGameCoordinates)=>void)=>void;
}

const DefaultZoom = 3;

const ZOOMTHRES = 6;

const mapCanvas = new MapCanvas();

const IconSize = 32;
const IconSizeSmall = 24;

export const Map: React.FC<MapProps> = ({icons, lines, setSetCenterListener}) => {
	const InGameOriginGeoCoord = useMemo(()=>{
		return inGameToGeoCoord(inGameCoord(0,0));
	}, []);
	const DynamicCanvasAnchorGeoCoord = useMemo(()=>{
		return inGameToGeoCoord(inGameCoord(-DynamicCanvasSizeX,-DynamicCanvasSizeZ));
	}, []);

	const [zoom, setZoom] = useState<number>(DefaultZoom);
	const [animating, setAnimating] = useState<boolean>(false);
	const [animationZoom, setAnimationZoom] = useState<number>(DefaultZoom);
	const [center, setCenter] = useState<GeoCoordinates>(geoCoord(0,0));
	const [manualSetCenter, setManualSetCenter] = useState<InGameCoordinates|undefined>(undefined);

	const realZoom = animating ? animationZoom : zoom;
	// For zoom <= 6, a single canvas that covers the entire map is used, and it's not redrawn when dragging
	// For zoom > 6, a single canvas would be too big, so we use a dynamic canvas and redraw it when dragging
	const dynamicCanvasMode = realZoom > ZOOMTHRES;

	const dynamicCanvasAnchor: [number, number] = useMemo(()=>{
		const scale = zoomToSvgScale(realZoom);
		const {ix: centerX, iz: centerZ} = geoToInGameCoord(center);
		const anchorGeo = inGameToGeoCoord(inGameCoord(centerX-DynamicCanvasSizeX/2/scale, centerZ-DynamicCanvasSizeZ/2/scale));
		return [anchorGeo.lat, anchorGeo.lng];
	}, [realZoom, center]);

	useEffect(()=>{
		setSetCenterListener(c=>{
			setManualSetCenter(c);
		});
	}, [setSetCenterListener]);
	useEffect(()=>{
		if(!manualSetCenter){
			return;
		}
		const centerInGameCoord = geoToInGameCoord(center);
		const THRESHOLD = 5;
		if(Math.abs(centerInGameCoord.ix-manualSetCenter.ix)<THRESHOLD && Math.abs(centerInGameCoord.iz-manualSetCenter.iz)<THRESHOLD){
			setManualSetCenter(undefined);
		}
	}, [center, manualSetCenter]);

	const canvasRef = useRef<HTMLCanvasElement>(null);

	// Static canvas render
	useEffect(()=>{
		if (dynamicCanvasMode){
			return;
		}
		if(!mapCanvas.bindAndReset(canvasRef.current)){
			return;
		}
		mapCanvas.withStaticCoordinateTransformer(zoom, (transformer)=>{
			icons.forEach(({coord, iconName})=>{
				mapCanvas.renderIcon(Icons[iconName], transformer(coord), zoom===2?IconSizeSmall:IconSize);
			});
		});
		
	}, [canvasRef, canvasRef.current, icons, zoom]);

	// Dynamic canvas render
	useEffect(()=>{
		if (!dynamicCanvasMode){
			return;
		}
		if(!mapCanvas.bindAndReset(canvasRef.current)){
			return;
		}
		mapCanvas.withDynamicCoordinateTransformer(center, zoom, (transformer)=>{
			icons.forEach(({coord, iconName})=>{
				mapCanvas.renderIcon(Icons[iconName], transformer(coord), IconSize);
			});
		});
		//mapCanvas.initDynamicCoordinateSystem(center, zoom);

	}, [canvasRef, canvasRef.current, icons, zoom, center]);

	const manualCenterGeo = manualSetCenter === undefined ? undefined : inGameToGeoCoord(manualSetCenter);
	const manualCenterLatLng = manualCenterGeo === undefined ? undefined : [manualCenterGeo.lat, manualCenterGeo.lng];

	const onAnimationZoomCallback = useCallback((animationZoom: number, _animationEnded: boolean)=>{
		setAnimating(true);
		setAnimationZoom(animationZoom);
  
		const canvas = canvasRef.current;

		if(animationZoom > ZOOMTHRES){
			if(!mapCanvas.bindAndReset(canvas)){
				return;
			}
			mapCanvas.withDynamicCoordinateTransformer(center, animationZoom, (transformer)=>{
				icons.forEach(({coord, iconName})=>{
					mapCanvas.renderIcon(Icons[iconName], transformer(coord), IconSize);
				});
			});

		}else{
			if(!canvas){
				return;
			}
			canvas.width = SvgSizeX*zoomToSvgScale(animationZoom);
			canvas.height = SvgSizeZ*zoomToSvgScale(animationZoom);
			if(!mapCanvas.bindAndReset(canvas)){
				return;
			}

			mapCanvas.withStaticCoordinateTransformer(animationZoom, (transformer)=>{
				icons.forEach(({coord, iconName})=>{
					mapCanvas.renderIcon(Icons[iconName], transformer(coord), animationZoom<3?IconSizeSmall:IconSize);
				});
			});
			
		}
	}, [canvasRef, canvasRef.current, center, icons]);
	
	const overrideProps = {
		provider: internalTileUrl,
		onAnimationZoomCallback,
		tileComponent:MapTile,
		//zoom,
		center: manualCenterLatLng,
		onBoundsChanged:({center,zoom}: {center: [number, number] /* lat, lng */, zoom: number})=>{
			setZoom(zoom);
			setCenter(geoCoord(center[0], center[1]));
			setAnimating(false);
            
		},
		minZoom: 2,
		maxZoom: 8,
		defaultZoom: DefaultZoom,
		defaultCenter: [InGameOriginGeoCoord.lat, InGameOriginGeoCoord.lng],
		attribution: <a style={{color: "rgb(0, 120, 168)", textDecoration: "none"}} href="https://objmap.zeldamods.org/" target="_blank" rel="noreferrer">objmap.zeldamods.org</a>,
		attributionPrefix: false,
	} as PigeonMapProps;
	return (
		<MapOverride {...overrideProps}>
			<Overlay 
				anchor={[InGameOriginGeoCoord.lat, InGameOriginGeoCoord.lng]} 
				offset={[SvgSizeX/2*zoomToSvgScale(realZoom),SvgSizeZ/2*zoomToSvgScale(realZoom)]}
			>
				<MapSvg zoom={realZoom} segs={lines}/>
			</Overlay>
			<Overlay 
				anchor={dynamicCanvasMode? dynamicCanvasAnchor :[DynamicCanvasAnchorGeoCoord.lat, DynamicCanvasAnchorGeoCoord.lng]} 
				offset={[0,0]}
			>
				{dynamicCanvasMode ?
					<canvas ref={canvasRef} width={DynamicCanvasSizeX} height={DynamicCanvasSizeZ}/>

					:
					<canvas ref={canvasRef} width={`${Math.floor(SvgSizeX*zoomToSvgScale(zoom))}`} height={`${Math.floor(SvgSizeZ*zoomToSvgScale(zoom))}`}/>
				}
			</Overlay>
		</MapOverride>
	);
};
