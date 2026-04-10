import React from 'react';
import ContentCard from '../components/ui/card';
import items from '../assets/items.json';
import Navbar from '../components/Layout/Navbar';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4">

      {/* Masonry Layout */}
      <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 w-full max-w-[1600px] mx-auto px-2">
        {items.map((item) => (
          <ContentCard 
            key={item.id}
            imageUrl={`https://picsum.photos/seed/${item.id}/400/${item.aspectRatio === 'tall' ? '600' : item.aspectRatio === 'extra-tall' ? '800' : '400'}`} 
            title={item.title} 
            creator={item.creator} 
            creatorImg={`https://avatar.iran.liara.run/public/${item.id + 10}`}
          />
        ))}
      </div>
    </div>
  );
}

export default HomePage;