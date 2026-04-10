from django.db import models
from django.conf import settings
from django.core.validators import MinLengthValidator, FileExtensionValidator


class Post(models.Model):
    POST_TYPES = [
        ('image', 'Image'),
        ('video', 'Video'),
        ('reel', 'Reel'),
        ('carousel', 'Carousel'),
    ]

    VISIBILITY = [
        ('public', 'Public'),
        ('followers', 'Followers Only'),
        ('private', 'Private'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posts'
    )
    post_type = models.CharField(max_length=10, choices=POST_TYPES, default='image')

    # Content
    caption = models.TextField(
        max_length=2200,
        blank=True,
        validators=[MinLengthValidator(0)]
    )

    # Media (for single image/video posts)
    media_file = models.FileField(
        upload_to='posts/%Y/%m/%d/',
        validators=[FileExtensionValidator(['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov'])]
    )
    thumbnail = models.ImageField(
        upload_to='thumbnails/%Y/%m/%d/',
        null=True,
        blank=True
    )

    # For carousel posts (multiple images)
    is_carousel = models.BooleanField(default=False)

    # Location (optional for posts)
    location_name = models.CharField(max_length=255, blank=True)
    location_country = models.CharField(max_length=100, blank=True)
    location_city = models.CharField(max_length=100, blank=True)
    location_lat = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True
    )
    location_lng = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True
    )

    # Engagement (denormalized fields for performance)
    likes_count = models.PositiveIntegerField(default=0)
    comments_count = models.PositiveIntegerField(default=0)
    shares_count = models.PositiveIntegerField(default=0)
    saves_count = models.PositiveIntegerField(default=0)

    # Settings
    visibility = models.CharField(max_length=10, choices=VISIBILITY, default='public')
    allow_comments = models.BooleanField(default=True)
    allow_sharing = models.BooleanField(default=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['visibility', '-created_at']),
            models.Index(fields=['post_type', '-created_at']),
        ]

    def __str__(self):
        return f"{self.user.username}'s {self.post_type} - {self.created_at}"

    @property
    def media_url(self):
        if self.media_file and hasattr(self.media_file, 'url'):
            return self.media_file.url
        return None

    @property
    def thumbnail_url(self):
        if self.thumbnail and hasattr(self.thumbnail, 'url'):
            return self.thumbnail.url
        return None

    def increment_likes(self):
        self.likes_count += 1
        self.save(update_fields=['likes_count'])

    def decrement_likes(self):
        self.likes_count = max(0, self.likes_count - 1)
        self.save(update_fields=['likes_count'])

    def increment_comments(self):
        self.comments_count += 1
        self.save(update_fields=['comments_count'])

    def decrement_comments(self):
        self.comments_count = max(0, self.comments_count - 1)
        self.save(update_fields=['comments_count'])


class CarouselImage(models.Model):
    """For posts with multiple images"""
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='carousel_images'
    )
    image = models.ImageField(
        upload_to='carousel/%Y/%m/%d/',
        validators=[FileExtensionValidator(['jpg', 'jpeg', 'png', 'gif'])]
    )
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        unique_together = ['post', 'order']

    def __str__(self):
        return f"Image {self.order} for post {self.post.id}"


class Like(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='likes'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('user', 'post')
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['post', '-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} liked post {self.post.id}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            # Update post likes count
            self.post.increment_likes()

    def delete(self, *args, **kwargs):
        post = self.post
        super().delete(*args, **kwargs)
        post.decrement_likes()


class Comment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    content = models.TextField(
        max_length=500,
        validators=[MinLengthValidator(1)]
    )
    likes_count = models.PositiveIntegerField(default=0)

    # For replies
    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='replies'
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['post', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['parent', '-created_at']),
        ]

    def __str__(self):
        return f"Comment by {self.user.username} on post {self.post.id}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.parent:
            # Only increment for top-level comments
            self.post.increment_comments()

    def delete(self, *args, **kwargs):
        post = self.post
        was_top_level = not self.parent
        super().delete(*args, **kwargs)
        if was_top_level:
            post.decrement_comments()


class CommentLike(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name='likes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'comment')

    def __str__(self):
        return f"{self.user.username} liked comment {self.comment.id}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            self.comment.likes_count += 1
            self.comment.save(update_fields=['likes_count'])

    def delete(self, *args, **kwargs):
        self.comment.likes_count = max(0, self.comment.likes_count - 1)
        self.comment.save(update_fields=['likes_count'])
        super().delete(*args, **kwargs)


# FOLLOW MODEL REMOVED - Now only in oauth app


class Save(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='saves'
    )
    collection = models.ForeignKey(
        'Collection',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='saved_posts'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} saved post {self.post.id}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            self.post.saves_count += 1
            self.post.save(update_fields=['saves_count'])

    def delete(self, *args, **kwargs):
        self.post.saves_count = max(0, self.post.saves_count - 1)
        self.post.save(update_fields=['saves_count'])
        super().delete(*args, **kwargs)


class Collection(models.Model):
    VISIBILITY = [
        ('public', 'Public'),
        ('private', 'Private'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='collections'
    )
    name = models.CharField(max_length=100)
    description = models.TextField(max_length=500, blank=True)
    cover_image = models.ImageField(
        upload_to='collection_covers/%Y/%m/%d/',
        null=True,
        blank=True
    )
    visibility = models.CharField(max_length=10, choices=VISIBILITY, default='private')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'name')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username}'s {self.name}"

    @property
    def posts_count(self):
        return self.saved_posts.count()


class Report(models.Model):
    REPORT_REASONS = [
        ('spam', 'Spam'),
        ('harassment', 'Harassment'),
        ('nudity', 'Nudity or sexual content'),
        ('violence', 'Violence or harmful content'),
        ('hate_speech', 'Hate speech'),
        ('copyright', 'Copyright infringement'),
        ('other', 'Other'),
    ]

    REPORT_STATUS = [
        ('pending', 'Pending'),
        ('reviewed', 'Reviewed'),
        ('resolved', 'Resolved'),
        ('dismissed', 'Dismissed'),
    ]

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reports_made'
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='reports'
    )
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='reports'
    )
    reason = models.CharField(max_length=20, choices=REPORT_REASONS)
    description = models.TextField(max_length=1000, blank=True)
    status = models.CharField(max_length=10, choices=REPORT_STATUS, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        if self.post:
            target = f"post {self.post.id}"
        else:
            target = f"comment {self.comment.id}"
        return f"Report by {self.reporter.username} on {target} - {self.reason}"
