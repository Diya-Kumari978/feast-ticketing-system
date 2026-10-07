import type {Metadata} from "next";import "./globals.css";import "./review.css";import SwipeNavigation from "@/components/swipe-navigation";
export const metadata:Metadata={title:"Feast — Tickets & entry",description:"Register for the university Feast and get your digital ticket."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<SwipeNavigation/></body></html>}
