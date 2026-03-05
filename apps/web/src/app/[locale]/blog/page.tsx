"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { HeroSection } from "@/components/ui/HeroSection";
import { BlogCard } from "@/components/ui/BlogCard";
import { Pagination } from "@/components/ui/Pagination";
import { blogPosts } from "@/data/posts";

const POSTS_PER_PAGE = 6;

export default function BlogPage() {
  const { t } = useI18n();
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(blogPosts.length / POSTS_PER_PAGE);
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
  const displayedPosts = blogPosts.slice(
    startIndex,
    startIndex + POSTS_PER_PAGE
  );

  return (
    <>
      <HeroSection
        title={t("blog.hero.title")}
        subtitle={t("blog.hero.subtitle")}
        size="md"
      />

      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Featured Post */}
          {currentPage === 1 && displayedPosts.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {t("blog.latestPosts")}
              </h2>
              <BlogCard post={displayedPosts[0]} variant="featured" />
            </div>
          )}

          {/* Posts Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(currentPage === 1 ? displayedPosts.slice(1) : displayedPosts).map(
              (post) => (
                <BlogCard key={post.slug} post={post} />
              )
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-12">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
