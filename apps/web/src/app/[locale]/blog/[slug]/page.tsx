import { notFound } from "next/navigation";
import Link from "next/link";
import { HeroSection } from "@/components/ui/HeroSection";
import { BlogCard } from "@/components/ui/BlogCard";
import { getPostBySlug, getAllPostSlugs, getLatestPosts } from "@/data/posts";
import { Locale } from "@/i18n/config";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";

interface BlogPostPageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getAllPostSlugs();
  const params = [];
  for (const slug of slugs) {
    params.push({ locale: "en", slug });
    params.push({ locale: "ar", slug });
  }
  return params;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { locale, slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const title = locale === "ar" ? post.title_ar : post.title_en;
  const content = locale === "ar" ? post.content_ar : post.content_en;

  const t = {
    backToBlog: locale === "ar" ? "العودة إلى المدونة" : "Back to Blog",
    publishedOn: locale === "ar" ? "نُشر في" : "Published on",
    relatedPosts: locale === "ar" ? "منشورات ذات صلة" : "Related Posts",
    minRead: locale === "ar" ? "دقائق قراءة" : "min read",
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  // Get related posts (excluding current)
  const relatedPosts = getLatestPosts(3).filter((p) => p.slug !== slug);

  return (
    <>
      <HeroSection
        title={title}
        subtitle=""
        size="sm"
      />

      <article className="py-16 bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Back Link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-medical-blue mb-8"
          >
            <ArrowLeft
              className={`w-4 h-4 ${locale === "ar" ? "rotate-180" : ""}`}
            />
            <span>{t.backToBlog}</span>
          </Link>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 mb-8">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {post.author}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t.publishedOn} {formatDate(post.date)}
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {post.readTime} {t.minRead}
            </span>
          </div>

          {/* Content */}
          <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100 mb-12">
            <div
              className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-a:text-medical-blue prose-strong:text-gray-900 prose-ul:text-gray-600"
              dangerouslySetInnerHTML={{ __html: formatContent(content) }}
            />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-12">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                {t.relatedPosts}
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((relatedPost) => (
                  <BlogCard key={relatedPost.slug} post={relatedPost} variant="compact" />
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    </>
  );
}

function formatContent(content: string): string {
  // Convert markdown-like content to HTML
  return content
    .replace(/## (.*)/g, "<h2>$1</h2>")
    .replace(/### (.*)/g, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/- (.*)/g, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}
